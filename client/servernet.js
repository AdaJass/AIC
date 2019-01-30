const req = require('request-promise');
const fs = require('fs')

class ServerNet { 
    constructor(servername, address){
        this.netnode = JSON.parse(fs.readFileSync('./netnode.json'));
        this.allservers = [];
        for(var node in this.netnode){
            for(var addr in this.netnode[node]){
                this.allservers.push(addr);
            }
        }
        this.mainnode = -1;
        this.address = address;
        this.servername = servername;
        this.initServerNet([]);
    }

    static setArray(arr){
        let kk={};
        let re=[];
        for(var a in arr){
            kk[arr[a]] = 0;
        }
        for(var k in kk){
            re.push(k);
        }
        return re;
    }

    static setJson(js1, js2){        
        for(var k in js1){
            if(js2[k]){
                js1[k] = js1[k].concat(js2[k]);
                js1[k] = ServerNet.setArray(js1[k]);
            }
        }
        return js1
    }

    static netnode2allserver(js){
        var re = [];
        for(var ser in js){
            for(var addr in js[ser]){
                re.push(addr);
            }
        }
        return re;
    }
     
    initServerNet(trylist){        
        if(this.allservers.length == 1){
            this.mainnode = this.allservers[0];
            return;
        }       
        var nextnode='';
        while(true){            
            nextnode = this.allservers[Math.floor(Math.random()*this.allservers.length)];
            if(nextnode == this.address || trylist.indexOf(nextnode)!=-1){
                continue;
            }else{
                trylist.push(nextnode)
                break;
            }
        }
        req.post(nextnode+'/netnode_allinfo')
            .then((b)=>{
                if(b){
                    var bjson = JSON.parse(b);
                    this.netnode = bjson.netnode;
                    this.allservers = bjson.allservers;
                    this.mainnode = bjson.mainnode;
                    if(this.allservers.indexOf(this.address) == -1){
                        var options = {
                            method: 'POST',
                            uri: this.mainnode+'/netnode_addnode',
                            body: {
                                server: this.servername,
                                address: this.address
                            },
                            json: true // Automatically stringifies the body to JSON
                        };
                        req(opthins);
                    }
                    return;
                }else{
                    this.initServerNet(trylist);
                }
            }); 
    }

    autoFollowMainNode(){
        req.post(this.mainnode +'/netnode_allserversjson')
            .then((body) =>{
                var bjson = JSON.parse(body);
                this.netnode = bjson;
                this.allservers = this.netnode2allserver(bjson);
            })
            .catch((err) =>{
                var premain = '';
                while(true){            
                    premain = this.allservers[Math.floor(Math.random()*this.allservers.length)];
                    if(premain == this.mainnode ||(premain == this.address && this.allservers.length>5)){
                        continue;
                    }else{
                        this.mainnode = premain;
                        break;
                    }
                }
                req.post(this.mainnode+ '/netnode_ping')
                    .then((body) =>{                        
                        this.setMainNode(this.address, this.mainnode);
                        setTimeout(this.autoFollowMainNode(), 600000);                        
                    })
                    .catch((err)=>{
                        this.autoFollowMainNode();
                    })
            });
    }

    setMainNode(enrolladdr, mainaddr){
        var options = {
            method: 'POST',
            uri: '',
            body: {
                enroll: enrolladdr,
                main: mainaddr
            },
            json: true // Automatically stringifies the body to JSON
        };
        for(var i in this.allservers){
            options.uri=this.allservers[i]+'/netnode_setmainnode';
            req(options);   /////////////??????????????????               
        }
    }

    prepare4MainNode(){
        if(this.mainnode != this.address){
            return;
        }
        var next = '';
        for(var i=0;i<5;i++){
            next = this.allservers[Math.floor(Math.random()*this.allservers.length)];
            req.post.post(next+'/netnode_allserversjson')
                .then((body)=>{
                    var bjson = JSON.parse(body);
                    this.netnode = ServerNet.setJson(this.netnode, bjson);                    
                }).then(()=>{
                    this.allservers = ServerNet.netnode2allserver(this.netnode); 
                });            
        }
               
    }

    addNode(server, address){
        if(this.netnode[server]){
            if(this.netnode[server].indexOf(address) == -1){
                this.netnode[server].push(address);
                this.allservers.push(address);
            }
            
        }else{
            this.netnode[server] = [address];
            this.allservers.push(address);
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

    checkInvalidNode(netnode) {   //this function will only invoke by the main node.
        if(this.address != this.mainnode){
            return;
        }        
        for(var ser in netnode){
            for(var addr in netnode[ser]){
                req.post(addr+'/netnode_ping')
                    .then((b)=>{
                    })
                    .catch((e)=>{
                        ServerNet.deleteNode(netnode, ser, addr);
                    });
            }
        }
    }   
}

module.exports = ServerNet;