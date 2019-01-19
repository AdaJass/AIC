/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const CONSTANT = require('../../constants/constant');
const ERROR = require('../../constants/error')

class FabUni extends Contract {

    async createTransferContract(ctx, transfer_logic, signatures, signaturesNeeded, expire=2592000000){
        /* 
        this function transfer one's wallet money to a contract wallet waiting for transfer agreement.
        transfer_logic: {
                from: jess, 
                amount: 1000, 
                to: {kitty: 1.0}
            }
        */
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();
        const transfer = JSON.parse(transfer_logic);
        let wallet = await ctx.stub.invokeChaincode('uni-token', ['retrieveOrCreateWallet', ctx, transfer.from]);
        wallet = JSON.parse(wallet);
        if(wallet.owner != identity){
            throw new Error(ERROR.NOPERMITTED);      
        }
        if(wallet.amount < transfer.amount){
            throw new Error(ERROR.INSUFFICIENT_FUNDS);   
        }
        const walletstr = await ctx.stub.invokeChaincode('uni-token', ['createContractWallet', ctx, transfer.from]);
        const wallet = JSON.parse(walletstr);
        await ctx.stub.invokeChaincode('uni-token', ['transfer', ctx, transfer.from, wallet]);
        let timenow = ctx.stub.getTxTimestamp();
        const contr ={
            creator: identity,
            contract_wallet: wallet.address,
            transferto: transfer.to,
            signatures: signatures,
            hadSigned: [],
            signaturesNeeded: signaturesNeeded,
            status: CONSTANT.ACTIVE,
            activefrom: timenow,
            activeto: timenow + expire
        }
        await ctx.stub.putState(identity, Buffer.from(JSON.stringify(contr)));
    }
  
    async queryContract(ctx){

    }

    async  

}