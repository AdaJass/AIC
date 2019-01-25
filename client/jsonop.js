module.exports={
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
}

};