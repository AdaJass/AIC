const router = require('koa-router')();
const fs = require('fs');
const servernet = require('./servernet');
const request = require('request-promise');
const config = require('./nodeconfig');
const sign = require('./signupandlogin');

const ServerNet = new servernet(config.server_name, config.server_address);

ServerNet.initServerNet();

var initThisServer = function(){
    if(ServerNet.mainnode == ServerNet.address){
        ServerNet.prepare4MainNode();
        ServerNet.checkInvalidNode();        
    }else{
        ServerNet.autoFollowMainNode();
        if(ServerNet.allservers.indexOf(ServerNet.address) == -1){
            //request the mainnode to addnode
            var options = {
                method: 'POST', uri: ServerNet.mainnode +'/netnode_addnode', 
                body: {
                    server: ServerNet.servername,
                    address: ServerNet.address
                },
                json: true
            };
            request(options);
        }
    }
    fs.writeFile('./netnode.json', JSON.stringify(ServerNet.netnode),(err)=>{});    
}

setInterval(initThisServer,20000);

router.post('/netnode_addnode',async(ctx, next)=>{
    if(ServerNet.mainnode != ServerNet.address){
        return ctx.body ='0';
    }
    var server = ctx.request.body.server;
    var address = ctx.request.body.address;   
    if(server && address){
        request.post(address + '/netnode_ping')
            .then((body)=> {
                if(body == '1'){
                    if(!ServerNet.addNode(server, address)){
                        return ctx.body = '0';
                    }
                    for(var ser in ServerNet.netnode){
                        for(var addr in ServerNet.netnode[ser]){
                            var options = {method: 'POST', uri: ServerNet.netnode[ser][addr] +'/netnode_receivenode', 
                                body: {
                                    server: server,
                                    address: address
                                },
                                json: true // Automatically stringifies the body to JSON
                            };
                            request(options);
                        }
                    }
                }
                
            }).catch((err)=>{
                console.log('the error is: '+err);
            }); 
        return ctx.body='1';       
    }
    return ctx.body = '0';    
});

router.post('/netnode_receivenode',async(ctx, next)=>{
    var server = ctx.request.body.server;
    var address = ctx.request.body.address;
    if(server && address){
        request.post(address+'/netnode_ping').then((body)=> {
            if(body == '1'){
                ServerNet.addNode(server, address);
            }
        });        
    }
    ctx.body = '1';
});

router.post('/netnode_deletenode',async(ctx, next)=>{
    var server = ctx.request.body.server;
    var address = ctx.request.body.address;    
    ServerNet.deleteNode(server, address);   
    ctx.body = '1';
});

router.post('/netnode_ping', async(ctx, next)=>{
    ctx.body = '1';
});

router.post('/netnode_allserversjson', async(ctx, next)=>{
    ctx.body = ServerNet.netnode;
});

router.post('/netnode_setmainnode', async(ctx, next)=>{
    console.log('setmainnode info:');
    console.log(ctx.request.body);
    var bjson = ctx.request.body;    
    if(ServerNet.allservers.indexOf(bjson.enroll) == -1 || ServerNet.allservers.indexOf(bjson.main) == -1){
        return ctx.body = '0';
    }
    ServerNet.mainnode = bjson.main;
    if(ServerNet.address == ServerNet.mainnode){
        ServerNet.prepare4MainNode();
    }
    return ctx.body = '1';
});

router.post('/netnode_allinfo', async(ctx, next)=>{
    ctx.body = {
        netnode: ServerNet.netnode,
        mainnode: ServerNet.mainnode,
        allservers: ServerNet.allservers
    }    
});

///////////////////////////////////////////////////
router.get('/', async (ctx, next) => {
    await ctx.render('index', {
        title: 'UNION',
        content:'sssssssssssssssss'
    });
});

router.get('/signup', async(ctx, next)=>{
    await ctx.render('signup', {
        title: 'UNION-Signup'
    });
});

router.post('/signup_emailcheck',async(ctx, next)=>{
    await sign.checkEmail(ctx);
});

router.post('/signup_signup',async(ctx, next)=>{
    await sign.signup(ctx);
})

router.get('/json', async (ctx, next) => {
    ctx.body = {
        title: 'koa2 json'
    }
});

module.exports = router;
