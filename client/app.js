
const Koa = require('koa');
const views = require('koa-views');
const nunjucks = require('nunjucks');
const json = require('koa-json');
const bodyparser = require('koa-bodyparser')();
const logger = require('koa-logger');
const onerror = require('koa-onerror');
const router = require('./router');



const app = new Koa();
nunjucks.configure('views', { autoescape: true });
//views with nunjucks
app.use(views(__dirname + '/views', {
    map: { html: 'nunjucks' }
}));

// middle wares
app.use(bodyparser);
app.use(json());
app.use(logger());
app.use(require('koa-static')(__dirname + '/public'));

// logger

app.use(async function (ctx, next) {
    const start = new Date();
    await next();
    const ms = new Date() - start;
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});


// routes

app.use(router.routes(), router.allowedMethods());

// error handler

onerror(app);


const port = 3000;
app.listen(port);
console.info('启动服务器在 http://localhost:' + port);
