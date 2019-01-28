const req = require('request');

class Utils { 
    constructor(){
        this.netnode = JSON.parse(fs.readFileSync('./netnode.json'));
        this.allservers = [];
        this.mainnode = -1;
    }
     
    addNode(netnode,server, address){
        if(netnode[server]){
            netnode[server].push(address);
        }else{
            netnode[server] = [address];
        }
    }

    deleteNode(netnode, server, address){
        var index = this.netnode[server].indexOf(address);
        if(index>-1) 
            this.netnode[server] = netnode[server].splice(index, 1);
        var iindex = this.allservers.indexOf(address);
        if(iindex>-1) 
            this.allservers = this.allservers.splice(index, 1);
    } 

    async checkInvalidNode(netnode) {   //this function will only invoke by the main node.
        
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

    async checkSelfNetnode(netnode){
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

module.exports = Utils;