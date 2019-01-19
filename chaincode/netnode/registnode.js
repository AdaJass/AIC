/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';


const { Contract } = require('fabric-contract-api');
const CONSTANT = require('../../constants/constant');
const ERROR = require('../../constants/error')

class FabUni extends Contract {
    
    async createNode(ctx, uri, name, type, reward, hash, weburls) {
        /*
        weburls = [mainpage, node_validate_interface, ...]
        */
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();
        if(identity){   //here judge whether it is admin identity or not .
            throw new Error(ERROR.NOT_PERMITTED);
        }
        if(typeof(uri) !='string' || typeof(name) !='string'){
            throw new Error(ERROR.VALIDATION);
        }
        const typereward = {'resource_server': 1000, 'standard_server': 480, 'thirdpart': 0, 'peer': 1000, 'order': 500, 'ca': 0}; 
        if(typeof(type) != 'string' || typeof(typereward[type]) == 'undefined'){
            throw new Error(ERROR.VALIDATION);   
        }
        const id= Math.random().toString(36).substr(3) + Math.random().toString(36).substr(3);
        let netnode={
            id: id,
            name: name,
            uri: uri,
            type: type,
            reward: typereward[type]
        };
        if(hash){
            netnode.hash = hash;
        }
        if(weburls.length>0){
            netnode.weburls = weburls;
        }
        await ctx.stub.putState(id, Buffer.from(JSON.stringify(netnode))); 
    }

    async changeReward(ctx, id, amount){
        const identity = ctx.getCreator().getIdBytes().toBuffer().toString();
        if(identity){   //here judge whether it is admin identity or not .
            throw new Error(ERROR.NOT_PERMITTED);
        }
        if(typeof(id) !='string' || typeof(amount) !='number'){
            throw new Error(ERROR.VALIDATION);
        }

        const netNodeAsBytes = await ctx.stub.getState(id); // get the car from chaincode state
        if (!netNodeAsBytes || netNodeAsBytes.length === 0) {
            throw new Error(`${id} does not exist`);
        }
        const netnode = JSON.parse(netNodeAsBytes.toString());
        netnode.amount = amount;

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(netnode)));
    }

    async queryNode(ctx, id){
        if(typeof(id) != 'string'){
            throw new Error(ERROR.VALIDATION);
        }
        const nodeAsByte = await ctx.stub.getState(id); // get the car from chaincode state
        if (!nodeAsByte || nodeAsByte.length === 0) {
            throw new Error(`${id} does not exist`);
        }
        // console.log(nodeAsByte.toString());
        return nodeAsByte.toString();
    }
}