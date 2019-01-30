const router = require('koa-router')();
const fs = require('fs');
const servernet = require('./servernet');
const request = require('request');
const config = require('./nodeconfig');
const ServerNet = new servernet(config.servername, config.serveraddress);
ServerNet.initServerNet();
console.log(ServerNet.netnode);
setInterval(()=>{
    ServerNet.autoFollowMainNode();
    fs.writeFile('./netnode.json', JSON.stringify(ServerNet.netnode),(err)=>{});    
},3600000);

router.post('/netnode_addnode',async(ctx, next)=>{
    var server = ctx.request.body.server;
    var address = ctx.request.body.address;
    if(server && address){
        request(address+'/netnode_ping', function (error, response, body) {
            if(response && body == '1'){
                ServerNet.addNode(netnode, server, address);
                for(var ser in netnode){
                    for(var addr in netnode[ser]){
                        request.post(addr+'/netnode_recievenode', {form:{'server': server, 'address': address}});
                    }
                }
            }
        });        
    }
    
});
router.post('/netnode_receivenode',async(ctx, next)=>{
    var server = ctx.request.body.server;
    var address = ctx.request.body.address;
    if(server && address){
        request(address+'/netnode_ping', function (error, response, body) {
            if(response && body == '1'){
                ServerNet.addNode(netnode, server, address);
            }
        });        
    }
});
router.post('/netnode_deletenode',async(ctx, next)=>{
    var server = ctx.request.body.server;
    var address = ctx.request.body.password;    
    ServerNet.deleteNode(netnode, server, address);   
});
router.post('/netnode_ping', async(ctx, next)=>{
    ctx.body = '1';
});

router.post('/netnode_allserversjson', async(ctx, next)=>{
    ctx.body = JSON.stringify(ServerNet.netnode);
});

router.post('/netnode_setmainnode', async(ctx, next)=>{
    var bjson = JSON.parse(ctx.body);
    if(ServerNet.allservers.indexOf(bjson.enroll) == -1 || ServerNet.allservers.indexOf(bjson.main) == -1){
        return;
    }
    ServerNet.mainnode = bjson.main;
    if(ServerNet.address == ServerNet.mainnode){
        ServerNet.prepare4MainNode();
    }
});

router.post('/netnode_allinfo', async(ctx, next)=>{
    ctx.body = {
        netnode: JSON.stringify(ServerNet.netnode),
        mainnode: ServerNet.mainnode,
        allservers: ServerNet.allservers
    }    
});

///////////////////////////////////////////////////
router.get('/', async (ctx, next) => {
    await ctx.render('index', {
        title: 'Hello Koa 2!',
        content:'sssssssssssssssss'
    })
});


router.get('/json', async (ctx, next) => {
    ctx.body = {
        title: 'koa2 json'
    }
});

module.exports = router;
