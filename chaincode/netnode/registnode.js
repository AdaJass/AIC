/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';


const { Contract } = require('fabric-contract-api');
const ERROR = require('./error');
const {X509} = require('jsrsasign');

class FabUni extends Contract {

    async init(ctx){
        FabUni.UNION_ADMIN = "3059301306072a8648ce3d020106082a8648ce3d0301070342000457575f98ac6c14a5a8ee8e8334121a21579b0823c033d0bfb0b06de29251adef69584f7cec38d7668677825738f83a0f32d4e6051a9b3d5c18714be96d863ca7";  
        return "init ok.";
    }
    
    async createNode(ctx, uri, name, type, hash) {
        /*
        uri is the website source uri, which help for the website update in the future.
        */
        const identity = FabUni.getPublicKey(ctx);
        if(identity != FabUni.UNION_ADMIN){   //here judge whether it is admin identity or not .
            throw new Error(ERROR.NOT_PERMITTED);
        }

        const netNodeAsBytes = await ctx.stub.getState(name); // get the car from chaincode state
        if (!netNodeAsBytes || netNodeAsBytes.length === 0) {
            if(typeof(uri) !='string' || typeof(name) !='string'){
                throw new Error(ERROR.VALIDATION);
            }
            const typereward = {'resource_server': 1000, 'standard_server': 480, 'thirdpart': 0, 'peer': 1000, 'order': 500, 'ca': 0}; 
            if(typeof(type) != 'string' || typeof(typereward[type]) == 'undefined'){
                throw new Error(ERROR.VALIDATION);   
            }
            let netnode={
                name: name,
                uri: uri,
                type: type,
                reward: typereward[type]
            };
            if(hash){
                netnode.hash = hash;
            }        
            await ctx.stub.putState(name, Buffer.from(JSON.stringify(netnode))); 
            return netnode;
        }else{
            return JSON.parse(netNodeAsBytes.toString())
        }        
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

    async changeAttribute(ctx, name, attr, val){
        const identity = FabUni.getPublicKey(ctx)
        if(identity != FabUni.UNION_ADMIN){   //here judge whether it is admin identity or not .
            throw new Error(ERROR.NOT_PERMITTED);
        }
        if(typeof(name) !='string' || typeof(attr) !='string' || typeof(val) != 'string'){
            throw new Error(ERROR.VALIDATION);
        }
        if(attr ==='reward'){
            val = parseFloat(val);  
            if(!(val>=0)){
                throw new Error(ERROR.VALIDATION);
            } 
        } 
        
        const netNodeAsBytes = await ctx.stub.getState(name); // get the car from chaincode state
        if (!netNodeAsBytes || netNodeAsBytes.length === 0) {
            throw new Error(`${name} does not exist`);
        }
        const netnode = JSON.parse(netNodeAsBytes.toString());
        if(attr === 'name'){
            await ctx.stub.deleteState(name);
            return await this.createNode(ctx,netnode.uri, val, netnode.type, netnode.hash);            
        }
        netnode[attr] = val;
        await ctx.stub.putState(name, Buffer.from(JSON.stringify(netnode)));
        return netnode;
    }

    async queryNode(ctx, name){
        if(typeof(name) != 'string'){
            throw new Error(ERROR.VALIDATION);
        }
        const nodeAsByte = await ctx.stub.getState(name); // get the car from chaincode state
        if (!nodeAsByte || nodeAsByte.length === 0) {
            throw new Error(`${name} does not exist`);
        }
        // console.log(nodeAsByte.toString());
        return JSON.parse(nodeAsByte.toString());
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