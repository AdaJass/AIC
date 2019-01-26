const req = require('request');

utils={ 
    allservers: [],   
    addNode : (netnode,server, address)=>{
        if(netnode[server]){
            netnode[server].push(address);
        }else{
            netnode[server] = [address];
        }
    },

    deleteNode :(netnode, server, address) =>{
        var index = netnode[server].indexOf(address);
        if(index>-1) 
            netnode[server] = netnode[server].splice(index, 1);
    } ,

    checkInvalidNode:(netnode) =>{   //this function will only invoke by the main node.
        
        for(var ser in netnode){
            for(var addr in netnode[ser]){
                request.get(addr+'/netnode_ping', (e,r,b)=>{
                    if(e){
                        utils.deleteNode(netnode, ser, addr);
                    }
                });
            }
        }
    },

    checkSelfNetnode: (netnode) =>{
        for(var ser in netnode){
            for(var addr in netnode[ser]){
                request.get(addr+'/netnode_ping', (e,r,b)=>{
                    if(e){
                        utils.deleteNode(netnode, ser, addr);
                    }
                });
            }
        }
    }

}

module.exports = utils;