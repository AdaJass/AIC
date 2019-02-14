/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const Cid = require('fabric-shim').ClientIdentity;
const CONSTANT = require('./../constants/constant');
const ERROR = require('./../constants/error');
const {X509} = require('jsrsasign');
const {sha3_256} = require('js-sha3'); // eslint-disable-line

class FabUni extends Contract {
    
    async initUnionCoin(ctx) {
        const identity_cert = ctx.stub.getCreator().getIdBytes().toBuffer().toString();
        let normcert = normalizeX509(identity_cert);
        const cert = new X509();
        cert.readCertPEM(normcert);
        const publicKey = cert.getPublicKeyHex();
        const publicKeyHash = sha3_256(publicKey);

        const walletAsBytes = await ctx.stub.getState('admim'); // get the wallet from chaincode state        
        if (!walletAsBytes || walletAsBytes.length === 0) {
            const wallet={
                address: 'admin',  //the address is a unique user name
                owner: publicKey,
                amount: 1e10,
                maxvalue: 1e10,
                endorse: 0,
                lastissuetime: ctx.stub.getTxTimestamp().low,
                type: CONSTANT.WALLET_TYPES.ADMIN
            }
            const walletstr = JSON.stringify(wallet);
            await ctx.stub.putState('admin',Buffer.from(walletstr));  
            let res =  JSON.parse(walletstr);
            const cid = new Cid(ctx.stub);
            res.mspid = cid.getMSPID();
            res.cid=cid.getID();  
            res.x509=cid.getX509Certificate();
            res.pkhash = publicKeyHash;  
            return res;
        }
        Console.log(ERROR.REISSUE_ERROR);
    }

    async test(ctx){
        const identity_cert = ctx.stub.getCreator().getIdBytes().toBuffer().toString();
        let normcert = normalizeX509(identity_cert);
        const cert = new X509();
        // const key = X509.getPublicKeyFromCertPEM(normcert)||0;
        cert.readCertPEM(normcert);
        const publicKeyHex = cert.getPublicKeyHex();        
        return {"certhex":publicKeyHex};
    }
   
    async createCoin(ctx, cpi){
        //check cpi to be a number.
        if(cpi<0.0 && cpi >4.0){
            throw new Error(ERROR.NOPERMITTED); 
        }
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();
        const walletstr = await this.retrieveOrCreateWallet(ctx, 'admin'); 
        let wallet = JSON.parse(walletstr);
        if(identity != wallet.owner){   
            throw new Error(ERROR.NOPERMITTED); 
        }
        if(wallet.endorse/wallet.amount<0.5){
            throw new Error(ERROR.NOPERMITTED); 
        }
        const timenow = new Date().getTime();
        if(timenow - wallet.lastissuetime < 365*24*3600*1000) {  
            throw new Error(ERROR.NOPERMITTED); 
        }
        const reissue = wallet.maxvalue * cpi/100;
        wallet.amount = wallet + reissue;
        wallet.maxvalue = wallet.maxvalue + reissue;
        wallet.lastissuetime = ctx.stub.getTxTimestamp();
        await ctx.stub.putState('admin', Buffer.from(JSON.stringify(wallet)));
    }
    
    async retrieveOrCreateWallet(ctx, addr){        
        //validate addr is a wallet_string.
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();
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
            return walletAsBytes.toString()
        }
        throw new Error(ERROR.NOPERMITTED);        
    } 

    async createContractWallet(ctx, contractid){
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();
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
        throw new Error(ERROR.NOPERMITTED);     
    } 

    async transfer(ctx, from, to, amount){
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();

        if(!(typeof(from)=='string' && typeof(to)=='string' && typeof(amount)=='number' && amount>0)){
            throw new Error(ERROR.VALIDATION);     
        }
        const fromWalletAsBytes = await ctx.stub.getState(from); 
        const toWalletAsBytes = await ctx.stub.getState(to);     
        if (!fromWalletAsBytes ||!toWalletAsBytes || fromWalletAsBytes.length === 0 || toWalletAsBytes.length === 0 ) {
            throw new Error(ERROR.NOPERMITTED);    
        }
        let fromWallet = JSON.parse(fromWalletAsBytes.toString());
        let toWallet = JSON.parse(toWalletAsBytes.toString());
        if(identity != fromWallet.identity){
            throw new Error(ERROR.NOPERMITTED); 
        }
        if(fromWallet.amount < amount){
            throw new Error(ERROR.INSUFFICIENT_FUNDS);
        }
        fromWallet.amount = fromWallet.amount - amount;
        toWallet.amount = toWallet.amount + amount;
        await ctx.stub.putState(Buffer.from(JSON.stringify(fromWallet)));
        await ctx.stub.putState(Buffer.from(JSON.stringify(toWallet)));
    }

    async requestContractTransfer(ctx, wallet_id){
        //inside get the contract id
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();
        let contr = await ctx.stub.invokeChaincode('multisig', ['queryContrat', ctx]);
        contr = JSON.parse(contr);
        const timenow = ctx.stub.getTxTimestamp();
        if(contr.activeto < timenow){
            await contractExpire(ctx, wallet_id);
            throw new Error(ERROR.CONTRACAT_EXPIRE);
        }
        if(contr.hadSigned.length < signaturesNeeded || contr.status != CONSTANT.CONTRACT_STATUS.ACTIVE){
            throw new Error(ERROR.NOT_PERMITTED);
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
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();
        let agentAsBytes = await ctx.stub.invokeChaincode('agent', ['queryAgent', ctx, agentid]);
        if (!agentAsBytes || agentAsBytes.length === 0) {
            throw new Error(`${id} does not exist`);
        }
        const agent = JSON.parse(agentAsBytes.toString());
        if(identity != agent.identity){
            throw new Error(ERROR.NOT_PERMITTED);
        }
        await ctx.stub.invokeChaincode('agent', ['afterTransferReward', ctx, agentid]);

        const fromWalletAsBytes = await ctx.stub.getState('admin'); 
        const toWalletAsBytes = await ctx.stub.getState(agent.wallet);     
        if (!fromWalletAsBytes ||!toWalletAsBytes || fromWalletAsBytes.length === 0 || toWalletAsBytes.length === 0 ) {
            throw new Error(ERROR.NOPERMITTED);    
        }
        let fromWallet = JSON.parse(fromWalletAsBytes.toString());
        let toWallet = JSON.parse(toWalletAsBytes.toString());
        const amount = agent.prereceivereward;
        if(fromWallet.amount < amount){
            throw new Error(ERROR.INSUFFICIENT_FUNDS);
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
        throw new Error('Failed to find start line or end line of the certificate.');
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
