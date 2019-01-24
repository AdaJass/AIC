const router = require('koa-router')();

router.get('/', async (ctx, next) => {
    await ctx.render('index', {
        title: 'Hello Koa 2!',
        content:'sssssssssssssssss'
    })
});

router.get('/webservers', async (ctx, next) => {
    await ctx.render('webservers',{
        title: 'webservers',
        content: 'ssss'
    })
});

router.get('/json', async (ctx, next) => {
    ctx.body = {
        title: 'koa2 json'
    }
});

module.exports = router;
