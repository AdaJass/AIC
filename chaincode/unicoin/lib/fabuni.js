/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const Cid = require('fabric-shim').ClientIdentity;
const CONSTANT = require('./../constants/constant');
const ERROR = require('./../constants/error');
const {X509} = require('jsrsasign');

class FabUni extends Contract {
    
    async initUnionCoin(ctx) {        
        const publicKey = FabUni.getPublicKey(ctx);   //hex form publicKey.

        const walletAsBytes = await ctx.stub.getState('admin'); // get the wallet from chaincode state        
        console.log("output res");
        console.log(walletAsBytes.toString());

        if (!walletAsBytes || walletAsBytes.length === 0) {
            const wallet={
                address: 'admin',  //the address is a unique user name
                owner: publicKey,
                amount: 1e10,
                maxvalue: 1e10,
                endorse: 1e10,
                lastissuetime: ctx.stub.getTxTimestamp().low,   //here is some error!!!
                type: CONSTANT.WALLET_TYPES.ADMIN
            }
            const walletstr = JSON.stringify(wallet);
            await ctx.stub.putState('admin',Buffer.from(walletstr));  
            let res =  JSON.parse(walletstr);
            return res;
        }
        console.log(ERROR.REISSUE_ERROR);
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
   
    async createCoin(ctx, cpi){
        //check cpi to be a number.
        cpi = parseFloat(cpi);
        if(cpi<0.0 && cpi >4.0){
            console.log('Error: cpi error, line 54'+ERROR.NOT_PERMITTED); 
            return "error!!!!!!!!!!!!!!!!!"
        }        
        const identity = FabUni.getPublicKey(ctx);
        console.log('hhhhhh', identity);
        const walletstr = await this.retrieveOrCreateWallet(ctx, 'admin'); 
        let wallet = JSON.parse(walletstr);
        if(identity != wallet.owner){   
            console.log('Error: identity error, line 62. '+ERROR.NOT_PERMITTED); 
            return "error!!!!!!!!!!!!!!!!!"
        }
        if(wallet.endorse/wallet.amount<0.5){    //remember to increase endorse number
            console.log('Error: endorse no enough, line 66. '+ERROR.NOT_PERMITTED); 
            return "error!!!!!!!!!!!!!!!!!"
        }
        const timenow = new Date().getTime();
        if(timenow - wallet.lastissuetime < /*365*24*3600*/1000) {  
            console.log('Error: time no enough, line 71. '+ERROR.NOT_PERMITTED); 
            return "error!!!!!!!!!!!!!!!!!"
        }
        console.log('the time of stub: ',wallet.lastissuetime,' the time of nodejs ',timenow);
        const reissue = wallet.maxvalue * cpi/100;
        wallet.amount = wallet.amount + reissue;
        wallet.maxvalue = wallet.maxvalue + reissue;
        wallet.lastissuetime = ctx.stub.getTxTimestamp().low;
        await ctx.stub.putState('admin', Buffer.from(JSON.stringify(wallet)));
        return wallet;
    }
    
    async retrieveOrCreateWallet(ctx, addr){        
        //validate addr is a wallet_string.
        const identity = FabUni.getPublicKey(ctx);
        const walletAsBytes = await ctx.stub.getState(addr); // get the wallet from chaincode state        
        if (!walletAsBytes || walletAsBytes.length === 0) {
            const wallet={
                address: addr,  //the address is a unique user name
                owner: identity,
                amount: 0,
                type: CONSTANT.WALLET_TYPES.USER
            }
            const walletstr = JSON.stringify(wallet);
            await ctx.stub.putState(addr, Buffer.from(walletstr));
            return walletstr;
        }
        const wallet = JSON.parse(walletAsBytes.toString());
        if(wallet.owner ==  identity){
            return JSON.parse(walletAsBytes.toString());
        }
        console.log('Error: createOrRetrieveWallet no Permmited retrieve. lien 102. '+ERROR.NOT_PERMITTED);        
        return "error!!!!!!!!!!!!!!!!!"
    } 

    async createContractWallet(ctx, contractid){
        const identity = FabUni.getPublicKey(ctx);
        const addr= Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
        const walletAsBytes = await ctx.stub.getState(addr); // get the wallet from chaincode state        
        if (!walletAsBytes || walletAsBytes.length === 0) {
            const wallet={
                address: addr,  //the address is a unique user name
                owner: identity,
                contractid: contractid,
                amount: 0,
                type: CONSTANT.WALLET_TYPES.CONTRACT
            }
            const walletstr = JSON.stringify(wallet);
            await ctx.stub.putState(addr, Buffer.from(walletstr));
            return walletstr;
        }
        const wallet = JSON.parse(walletAsBytes.toString());
        if(wallet.owner ==  identity){
            return walletAsBytes.toString()
        }
        console.log('Error: createContractWallet no Permmited retrieve. lien 102. '+ERROR.NOT_PERMITTED);     
        return "error!!!!!!!!!!!!!!!!!"
    } 

    async transfer(ctx, from, to, amount){
        const identity = FabUni.getPublicKey(ctx);

        if(!(typeof(from)=='string' && typeof(to)=='string' &&amount>0)){
            console.log('Error: type error, line 134. '+ERROR.VALIDATION);     
            return "error!!!!!!!!!!!!!!!!!"
        }
        const fromWalletAsBytes = await ctx.stub.getState(from); 
        const toWalletAsBytes = await ctx.stub.getState(to);     
        if (!fromWalletAsBytes ||!toWalletAsBytes || fromWalletAsBytes.length === 0 || toWalletAsBytes.length === 0 ) {
            console.log('Error: trasefer wallet not exist. lien 140. '+ERROR.NOT_PERMITTED);    
            return "error!!!!!!!!!!!!!!!!!"
        }
        let fromWallet = JSON.parse(fromWalletAsBytes.toString());
        let toWallet = JSON.parse(toWalletAsBytes.toString());
        if(identity != fromWallet.identity){
            console.log('Error: fromwallet identity error. line 146. '+ERROR.NOT_PERMITTED); 
            return "error!!!!!!!!!!!!!!!!!"
        }
        if(fromWallet.amount < amount){
            console.log('Error: from wallet amout not enough. line 150. '+ERROR.INSUFFICIENT_FUNDS);
            return "error!!!!!!!!!!!!!!!!!"
        }
        fromWallet.amount = fromWallet.amount - amount;
        toWallet.amount = toWallet.amount + amount;
        await ctx.stub.putState(Buffer.from(JSON.stringify(fromWallet)));
        await ctx.stub.putState(Buffer.from(JSON.stringify(toWallet)));
    }

    async requestContractTransfer(ctx, wallet_id){
        //inside get the contract id
        const identity = FabUni.getPublicKey(ctx);
        let contr = await ctx.stub.invokeChaincode('multisig', ['queryContrat', ctx]);
        contr = JSON.parse(contr);
        const timenow = ctx.stub.getTxTimestamp();
        if(contr.activeto < timenow){
            await contractExpire(ctx, wallet_id);
            console.log('Error: '+ERROR.CONTRACAT_EXPIRE);
            return "error!!!!!!!!!!!!!!!!!"
        }
        if(contr.hadSigned.length < signaturesNeeded || contr.status != CONSTANT.CONTRACT_STATUS.ACTIVE){
            console.log('Error: '+ERROR.NOT_PERMITTED);
            return "error!!!!!!!!!!!!!!!!!"
        }

        let conWallet = await ctx.stub.getState(wallet_id);
        conWallet = JSON.parse(conWallet);
        const totalAmount = conWallet.amount;
        for(wallet in contr.to){
            let toWallet = await ctx.stub.getState(wallet);
            toWallet = JSON.parse(toWallet);
            toWallet.amount = toWallet.amount + totalAmount * contr.to[wallet];
            await ctx.stub.putState(wallet, Buffer.from(JSON.stringify(toWallet))); 
        }
        conWallet.amount = 0;
        conWallet.status = CONSTANT.WALLET_TYPES.INVALID;     
        await ctx.stub.putState(wallet_id, Buffer.from(JSON.stringify(conWallet)));    
        await ctx.stub.invokeChaincode('multisig', ['changeContratStatus', ctx, conWallet.contractid]);

    }

    async transferReward(ctx, agentid){
        const identity = FabUni.getPublicKey(ctx);
        let agentAsBytes = await ctx.stub.invokeChaincode('agent', ['queryAgent', ctx, agentid]);
        if (!agentAsBytes || agentAsBytes.length === 0) {
            console.log('Error: '+`${id} does not exist`);
            return "error!!!!!!!!!!!!!!!!!"
        }
        const agent = JSON.parse(agentAsBytes.toString());
        if(identity != agent.identity){
            console.log('Error: '+ERROR.NOT_PERMITTED);
            return "error!!!!!!!!!!!!!!!!!"
        }
        await ctx.stub.invokeChaincode('agent', ['afterTransferReward', ctx, agentid]);

        const fromWalletAsBytes = await ctx.stub.getState('admin'); 
        const toWalletAsBytes = await ctx.stub.getState(agent.wallet);     
        if (!fromWalletAsBytes ||!toWalletAsBytes || fromWalletAsBytes.length === 0 || toWalletAsBytes.length === 0 ) {
            console.log('Error: '+ERROR.NOT_PERMITTED);    
            return "error!!!!!!!!!!!!!!!!!"
        }
        let fromWallet = JSON.parse(fromWalletAsBytes.toString());
        let toWallet = JSON.parse(toWalletAsBytes.toString());
        const amount = agent.prereceivereward;
        if(fromWallet.amount < amount){
            console.log('Error: '+ERROR.INSUFFICIENT_FUNDS);
            return "error!!!!!!!!!!!!!!!!!"
        }
        fromWallet.amount = fromWallet.amount - amount;
        toWallet.amount = toWallet.amount + amount;
        await ctx.stub.putState(Buffer.from(JSON.stringify(fromWallet)));
        await ctx.stub.putState(Buffer.from(JSON.stringify(toWallet)));

    }

    async contractExpire(ctx, wallet_id){

    }
    
}


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

module.exports = FabUni;
