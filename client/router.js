const router = require('koa-router')();
const fs = require('fs');
const nodeop = require('./jsonop');
const request = require('request');




let netnode = JSON.parse(fs.readFileSync('./netnode.json'));
console.log(netnode);
setInterval(()=>{fs.writeFileSync('./netnode.json', JSON.stringify(netnode))},3600000);

router.post('/netnode_addnode',async(ctx, next)=>{
    var server = ctx.request.body.server;
    var address = ctx.request.body.password;
    if(server && address){
        request(address+'/testserveralive', function (error, response, body) {
            if(response && body == '1'){
                nodeop.addNode(netnode, server, address);
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
    var address = ctx.request.body.password;
    if(server && address){
        request(address+'/testserveralive', function (error, response, body) {
            if(response && body == '1'){
                nodeop.addNode(netnode, server, address);
            }
        });        
    }
});
router.post('/netnode_deletenode',async(ctx, next)=>{

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
