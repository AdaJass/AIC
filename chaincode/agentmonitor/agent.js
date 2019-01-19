/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const CONSTANT = require('../../constants/constant');
const ERROR = require('../../constants/error')
const crypto = require('crypto');
const request = require('request')

class Monitor extends Contract {
    
    async createAgent(ctx, wallet, netnodeid, currenturl) {
        //registation
        if(typeof(wallet) !='string' || typeof(netnodeid) !='string' || typeof(currenturl) !='string'){
            throw new Error(ERROR.VALIDATION);
        }
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();
        const transfer = JSON.parse(transfer_logic);
        let wallet = await ctx.stub.invokeChaincode('uni-token', ['retrieveOrCreateWallet', ctx, transfer.from]);
        wallet = JSON.parse(wallet);
        if(wallet.owner != identity){
            throw new Error('Wrong wallet address');
        }        
        
        let timenow = ctx.stub.getTxTimestamp();
        const id= Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
        const agent ={
            id: id,
            identity: identity,
            wallet: wallet,            
            netnodeid: netnodeid,
            currenturl: currenturl,
            score: 0,
            prereceivereward: 0,            
            passcheck: false,
            securitycode: '', 
            lastheartbeat: timenow
        };
        
        await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));         
    }

    async readyForHeartbeat(ctx,id, url){
        //maintain a list of {id: security_code} and renew them once invoked.
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();
        if(typeof(id) != 'string' || typeof(url) != 'string'){
            throw new Error(ERROR.VALIDATION);
        }
        let netnode = await ctx.stub.invokeChaincode('netnode', ['queryNode', ctx, id]);
        netnode = JSON.parse(netnode.toString());
        if(netnode.type != 'standard_server' || netnode.type != 'resource_server'){
            throw new Error('net node unpair.');
        }
        const agentAsBytes = await ctx.stub.getState(id); 
        if (!agentAsBytes || agentAsBytes.length === 0) {
            throw new Error(`${id} does not exist`);
        }
        const agent = JSON.parse(agentAsBytes.toString());
        agent.securitycode = Math.random().toString(36).substr(3,7);
        agent.currenturl = url;

        let posturl = url;
        if(url[url.length-1] == '/'){
            posturl += netnode.weburls[1];
        }else{
            posturl = posturl + '/' + netnode.weburls[1];
        }

        request.post(posturl, {form:{key:agent.securitycode}}); // if there is no response? let it be.

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));
        return JSON.stringify(agent)
    }

    async ipChange(ctx,id, url){
        //maintain a list of {id: security_code} and renew them once invoked.
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();
        const agentAsBytes = await ctx.stub.getState(id); 
        if (!agentAsBytes || agentAsBytes.length === 0) {
            throw new Error(`${id} does not exist`);
        }

        const agent = JSON.parse(agentAsBytes.toString());
        agent.currenturl = url;
        await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));
        return JSON.stringify(agent)
    }
    
    async agentHeartbeat(ctx, id, data){
        //validation, give out reward
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();        
        const agentAsBytes = await ctx.stub.getState(id); 
        if (!agentAsBytes || agentAsBytes.length === 0) {
            throw new Error(`${id} does not exist`);
        }
        const agent = JSON.parse(agentAsBytes.toString());
        if(identity != agent.identity){
            throw new Error(ERROR.NOT_PERMITTED);
        }
        let timenow = ctx.stub.getTxTimestamp();
        if(timenow - agent.lastheartbeat < 3600*1000*4){  //heartbeat every 4 hour
            throw new Error('Can not heartbeat yet');
        }

        let netnode = await ctx.stub.invokeChaincode('netnode', ['queryNode', ctx, id]);
        netnode = JSON.parse(netnode.toString());
        if(netnode.type != 'standard_server' || netnode.type != 'resource_server'){
            agent.passcheck = true;
            agent.lastheartbeat = timenow;
            return await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));
        }

        /*
    router.post("/encrypt",function(req,res){
        var str=req.body.str;//明文
        var cipher = crypto.createCipher('aes192', secret);
        var enc = cipher.update(str, 'utf8', 'hex');//编码方式从utf-8转为hex;
        enc += cipher.final('hex');//编码方式从转为hex;
        res.send(enc);
    });
    //解密
    router.post("/decrypt",function(req,res){
        var str=req.body.str;//明文
        var decipher = crypto.createDecipher('aes192', secret);
        var dec = decipher.update(str, 'hex', 'utf8');//编码方式从hex转为utf-8;
        dec += decipher.final('utf8');//编码方式从utf-8;
        res.send(dec);
    });
        */
        
        let decipher = crypto.createDecipher('aes192', agent.securitycode);
        let nodedata = decipher.update(data, 'hex', 'utf8');//编码方式从hex转为utf-8;
        nodedata += decipher.final('utf8'); //编码方式从utf-8;
        //now the nodedata contain data from the netnode.
        /*
        nodedate={
            hardwarescore:
            networkscore:
            currenturl:
            maincodehash:            
        }
        */ 
        //here determine the score
        nodedata = JSON.parse(nodedata);        
        let score = nodedata.hardwarescore > nodedata.networkscore ? nodedata.networkscore : nodedata.hardwarescore;
        let validpass = await this.validNetnode(ctx, nodedata.maincodehash, netnode.weburls);
        if(!validpass){
            throw new Error('can not get the server.')
        }
        agent.score = score;
        agent.passcheck = true;
        agent.lastheartbeat = timenow;
        return await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));
    }

    async preTransferReward(ctx, id){
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();        
        const agentAsBytes = await ctx.stub.getState(id); 
        if (!agentAsBytes || agentAsBytes.length === 0) {
            throw new Error(`${id} does not exist`);
        }
        const agent = JSON.parse(agentAsBytes.toString());
        if(identity != agent.identity){
            throw new Error(ERROR.NOT_PERMITTED);
        }
        let timenow = ctx.stub.getTxTimestamp();
        if(timenow - agent.lastheartbeat > 3600*1000*4){  //heartbeat every 4 hour
            throw new Error('Not valid reward request.');
        }
        if(!agent.passcheck){
            throw new Error('Not permitted reward request.');
        }
        let typenode = await this.calculateTypeNode(ctx, typenode);
        let netnode = await ctx.stub.invokeChaincode('netnode', ['queryNode', ctx, id]);
        netnode = JSON.parse(netnode.toString());
        const reward = netnode.reward / netnode;

        if(netnode.type != 'standard_server' || netnode.type != 'resource_server'){
            agent.prereceivereward = reward;
            return await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));
        }else{
            agent.prereceivereward = reward*agent.score/10;
            return await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));
        }

    }

    async afterTransferReward(ctx, id){
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();        
        const agentAsBytes = await ctx.stub.getState(id); 
        if (!agentAsBytes || agentAsBytes.length === 0) {
            throw new Error(`${id} does not exist`);
        }
        const agent = JSON.parse(agentAsBytes.toString());
        if(identity != agent.identity){
            throw new Error(ERROR.NOT_PERMITTED);
        }
        agent.check = false;
        agent.score = 0;
        agent.prereceivereward = 0;
        return await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));

    }

    async queryAgent(ctx, id){
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();
        const agentAsBytes = await ctx.stub.getState(id); 
        if (!agentAsBytes || agentAsBytes.length === 0) {
            throw new Error(`${id} does not exist`);
        }
        
        if(identity != agent.identity){
            throw new Error(ERROR.NOT_PERMITTED);
        }
        
        return agentAsBytes.toString();
    }

    async calculateTypeNode(ctx, netnodeid){
        const nodeiter = await ctx.stub.getQueryResult({
            'selector': {
                'netnodeid': netnodeid
            }
        });
        const nodelist = iteratorToList(nodeiter);
        return nodelist.length;        
    }

    async validNetnode(ctx, hashs, urls){
        
    }
}


const iteratorToList = async function iteratorToList(iterator) {
    const allResults = [];
    let res;
    while (res == null || !res.done) {
        res = await iterator.next();
        if (res.value && res.value.value.toString()) {
            const jsonRes = {};
            logger.debug(res.value.value.toString('utf8'));

            jsonRes.key = res.value.key;
            try {
                jsonRes.record = JSON.parse(res.value.value.toString('utf8'));
            } catch (err) {
                logger.debug(err);
                jsonRes.record = res.value.value.toString('utf8');
            }

            if (res.value.timestamp) {
                jsonRes.lastModifiedOn = timestampToDate(res.value.timestamp);
            }

            allResults.push(jsonRes);
        }
    }

    logger.debug('end of data');
    await iterator.close();
    logger.info(JSON.stringify(allResults));

    return allResults;
};