/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const ERROR = require('./error')
const crypto = require('crypto');
const request = require('request-promise');
const {X509} = require('jsrsasign');

class Monitor extends Contract {

    async init(ctx){
        return "init ok."
    }

    async testinvoke(ctx, wallet_addr){
        let result = await ctx.stub.invokeChaincode('unicoin', ['retrieveWallet', wallet_addr]);
        if (result == null || result.status !== 200){
            return "no result."
        }
        const wallet = JSON.parse(result.payload.toString('utf8'));
        return wallet;
    }
    
    async createAgent(ctx, wallet_addr, netnodeid, currenturl) {
        //registation
        if(typeof(wallet_addr) !='string' || typeof(netnodeid) !='string' || typeof(currenturl) !='string'){
            throw new Error(ERROR.VALIDATION);
        }
        const identity = Monitor.getPublicKey(ctx);
        let result = await ctx.stub.invokeChaincode('unicoin', ['retrieveWallet', wallet_addr]);
        if (!result || result.status !== 200){
            return "no result."
        }
        const wallet = JSON.parse(result.payload.toString('utf8'));
        if(wallet.owner != identity){
            throw new Error('Wrong wallet address');
        } 
        let result = await ctx.stub.invokeChaincode('uninode', ['queryNode', netnodeid]);
        if (!result || result.status !== 200){
            return "no this node type."
        }
        //const netnode = JSON.parse(result.payload.toString('utf8'));       
        
        let timenow = ctx.stub.getTxTimestamp().seconds.low;
        const id= Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
        const agent ={
            id: id,
            identity: identity,
            wallet: wallet_addr,            
            netnodeid: netnodeid,
            currenturl: currenturl,    //  ip:port/mainpage
            score: 0,
            prereceivereward: 0,            
            passcheck: false,
            securitycode: '',      //server encrypt
            lastheartbeat: timenow
        };
        
        await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));   
        return agent;      
    }

    static getPublicKey(ctx){
        const identity_cert = ctx.stub.getCreator().getIdBytes().toBuffer().toString();
        let normcert = normalizeX509(identity_cert);
        const cert = new X509();
        // const key = X509.getPublicKeyFromCertPEM(normcert)||0;
        cert.readCertPEM(normcert);
        const publicKeyHex = cert.getPublicKeyHex();        
        return publicKeyHex;
    }

    async readyForHeartbeat(ctx,id, url){
        //maintain a list of {id: security_code} and renew them once invoked.
        const identity = Monitor.getPublicKey(ctx);
        if(typeof(id) != 'string' || typeof(url) != 'string'){
            throw new Error(ERROR.VALIDATION);
        }
        
        const agentAsBytes = await ctx.stub.getState(id); 
        if (!agentAsBytes || agentAsBytes.length === 0) {
            throw new Error(`${id} does not exist`);
        }
        const agent = JSON.parse(agentAsBytes.toString());

        if(identity !=agent.identity){
            return "is not your server!"
        }

        let result = await ctx.stub.invokeChaincode('uninode', ['queryNode', id]);
        if (result == null || result.status !== 200){
            return "no result."
        }
        const netnode = JSON.parse(result.payload.toString('utf8'));
        if(netnode.type != 'standard_server' || netnode.type != 'resource_server'){
            throw new Error('net node unpair.');
        }

        agent.securitycode = Math.random().toString(36).substr(3,7);
        agent.currenturl = url;

        let posturl = url;
        if(url[url.length-1] == '/'){
            posturl += netnode.weburls[1];
        }else{
            posturl = posturl + '/' + netnode.weburls[1];  //get the validation url
        }

        var options = {
            method: 'POST',
            uri: posturl,
            body: {key:agent.securitycode},
            json: true // Automatically stringifies the body to JSON
        };        
        rp(options).then((body)=>{});

        request.post(posturl, {form:{key:agent.securitycode}}); // if there is no response? let it be.

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));
        return JSON.stringify(agent)
    }

    async ipChange(ctx,id, url){
        //maintain a list of {id: security_code} and renew them once invoked.
        const identity = Monitor.getPublicKey(ctx);
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
        /*
        agent heart beat flow:
            agent server invoke readyForHeartbeat  -> send random security code to agent server
            -> agentserver invoke angentHeartbeat with decrypt data  -> heartbeat secceed.
        */
        const identity = Monitor.getPublicKey(ctx);        
        const agentAsBytes = await ctx.stub.getState(id); 
        if (!agentAsBytes || agentAsBytes.length === 0) {
            throw new Error(`${id} does not exist`);
        }
        const agent = JSON.parse(agentAsBytes.toString());
        if(identity != agent.identity){
            throw new Error(ERROR.NOT_PERMITTED);
        }
        let timenow = ctx.stub.getTxTimestamp().seconds.low;
        if(timenow - agent.lastheartbeat < 3600*4){  //heartbeat every 4 hour
            throw new Error('Can not heartbeat yet');
        }

        let result = await ctx.stub.invokeChaincode('netnode', ['queryNode', id]);
        if (result == null || result.status !== 200){
            return "no result."
        }
        const netnode = JSON.parse(result.payload.toString('utf8'));
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
        let agentdata = decipher.update(data, 'hex', 'utf8');//编码方式从hex转为utf-8;
        agentdata += decipher.final('utf8'); //编码方式从utf-8;
        //now the agentdata contain data from the netnode.
        /*
        nodedate={
            hardwarescore:
            networkscore:
            currenturl:
            maincodehash:  
            pagehashs: []          
        }
        */ 
        //here determine the score
        agentdata = JSON.parse(agentdata);        
        let score = agentdata.hardwarescore > agentdata.networkscore ? agentdata.networkscore : agentdata.hardwarescore;
        let validpass = await this.validNetnode(ctx, agentdata, netnode);
        if(!validpass){
            throw new Error('can not get the server.')
        }
        agent.score = score;
        agent.passcheck = true;
        agent.lastheartbeat = timenow;
        return await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));
    }

    async preTransferReward(ctx, id){
        const identity = Monitor.getPublicKey(ctx);        
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
        let result = await ctx.stub.invokeChaincode('netnode', ['queryNode', id]);
        if (result == null || result.status !== 200){
            return "no result."
        }
        const netnode = JSON.parse(result.payload.toString('utf8'));
        const reward = netnode.reward / typenode;

        if(netnode.type != 'standard_server' || netnode.type != 'resource_server'){
            agent.prereceivereward = reward;
            return await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));
        }else{
            agent.prereceivereward = reward*agent.score/10;
            return await ctx.stub.putState(id, Buffer.from(JSON.stringify(agent)));
        }

    }

    async afterTransferReward(ctx, id){
        const identity = Monitor.getPublicKey(ctx);        
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
        const identity = Monitor.getPublicKey(ctx);
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

    async validNetnode(ctx, agentdata, netnode){
        /*
        validate the agent is working well, by two aspect:
           1. both agentdata's pagehashs and the current request page hashs are the same
           2.core source code hash is the same as standard hash.
        */

        if(agentdata.maincodehash != netnode.hash){
            return false;
        }
        let ip='';
        if(agentdata.currenturl[agentdata.currenturl.length-1] == '/'){
            ip = agentdata.currenturl.slice(0,-1);
        }else{
            ip = agentdata.currenturl;
        }
        let pass = true;
        ((n)=>{
            n = n+1;
            if(n >= agentdata.pagehashs.length){
                return;
            }
            request(ip+'/'+ netnode.weburls[n])
                .then((body)=>{
                    const hash = crypto.createHash('sha256');
                    hash.update(body);
                    if(hash.digest('hex') != agentdata.pagehashs[n]){
                        pass = false;
                        return;
                    }
                })
                .catch((e)=>{
                    pass = false;
                    return;
                });
        })(0);
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


function normalizeX509(raw) {
    // logger.debug(`[normalizeX509]raw cert: ${raw}`);
    const regex = /(\-\-\-\-\-\s*BEGIN ?[^-]+?\-\-\-\-\-)([\s\S]*)(\-\-\-\-\-\s*END ?[^-]+?\-\-\-\-\-)/;
    let matches = raw.match(regex);
    if (!matches || matches.length !== 4) {
        console.log('Error: '+'Failed to find start line or end line of the certificate.');
        return "error!!!!!!!!!!!!!!!!!"
    }

    // remove the first element that is the whole match
    matches.shift();
    // remove LF or CR
    matches = matches.map((element) => {
        return element.trim();
    });

    // make sure '-----BEGIN CERTIFICATE-----' and '-----END CERTIFICATE-----' are in their own lines
    // and that it ends in a new line
    return matches.join('\n') + '\n';
}

module.exports = Monitor;