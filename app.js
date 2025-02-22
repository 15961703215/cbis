const Koa = require('koa');
var path = require('path');
let koaBody = require('koa-body');
const cors = require('koa2-cors'); // 跨域
const chalk = require('chalk'); // color
const server = require('koa-static');
const views = require('koa-views'); // views
const http = require('http');
const fs = require('fs');
const LogFile = require('./middlewares/logHelper');
const apiError = require("./middlewares/apiError");
const FormatOutput = require("./middlewares/formatOutput");
const accessToken = require("./middlewares/accessToken");

const session=require('koa-session')




// //数据库连接
// const mySql = require('mysql');
//
// //创建数据库链接，用于操作数据库
// const db=mySql.createConnection({host:"localhost",user:"root",password:"root",database:"CBIS"})
// db.connect((err)=>{
// 	if (err) throw err;
// 	console.log('连接数据库成功');
// })

const app = new Koa();



const formatOutput = new FormatOutput();
// const logger = new LogFile({
// 	appenders: {file: {filename: __dirname + "/logs/api.log", maxLogSize: 2048000}},
// 	categories: {
// 		file:{appenders: ['file'], level: 'debug'}
// 	},
// 	pm2InstanceVar: 'INSTANCE_ID_API'
// });

global.dbLogger = require('./middlewares/dbLogHelper').dbLoger;
logger = require('./middlewares/dbLogHelper').accessLogger;
errlogger=require('./middlewares/dbLogHelper').errorLogger;
// function
Date.prototype.format = function (fmt) {
	var o = {
		"M+": this.getMonth() + 1, //月份
		"d+": this.getDate(), //日
		"h+": this.getHours(), //小时
		"s+": this.getSeconds(), //秒
		"q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "m+": this.getMinutes(), //分
		"S": this.getMilliseconds() //毫秒
	};
	if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
	for (var k in o)
		if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
	return fmt;
};

function time(start,end) {
	const delta = end - start;
	return (delta < 10000
		? delta + 'ms'
		: Math.round(delta / 1000) + 's');
}

// Koa 推荐使用该命名空间挂载数据
//app.context.mongodb = mongodb.db;
// app.context.db=db;

//启动session
app.keys = ['some secret hurr'];
const config={
	key:'koa:sess',
	maxAge:60*1000*20,    // cookie的过期时间,毫秒，默认为1天
	overwrite:true,
	httpOnly:true,       // cookie是否只有服务器端可以访问,默认为true
	signed:true,
	rolling:true,   //每次访问将会重置过期时间
	renew:true     // (boolean) 会话即将到期时,续订会话
}
app.use(session(config,app))

// 中间件 middlewares
app.use(cors()); // 跨域

// app.use(json());
// 静态文件 static file dir
app.use(server(__dirname + '/public'));
app.use(server(__dirname + '/files'));

//静态页面 static HTML
app.use(views(__dirname + '/views', {
	map: {html: 'ejs'}
}));

// 日志 log
app.use(async (ctx, next) => {
	let start = Date.now();
	try {
		console.log(chalk.green('%s') + chalk.gray(' <--')
			+ chalk.bold(' %s')
			+ chalk.gray(' %s'),
			(new Date(start)).format('yyyy-MM-dd hh:mm:ss.S'),
			ctx.method,
			ctx.originalUrl);
		ctx.state.ApiError = apiError;
		await next();
		let end = Date.now();
		let ms =time(start,end);
		//记录响应日志
		logger.debug(formatOutput.formatRes(ctx,ms));
		console.log(chalk.green('%s')
			+ chalk.gray(' -->')
			+ chalk.bold(' %s')
			+ chalk.gray(' res:%s')
			+ chalk.green(' %s')
			+ chalk.gray(' %s'),
			(new Date(end)).format('yyyy-MM-dd hh:mm:ss.S'),
			ctx.method,
			JSON.stringify(ctx.body),
			ctx.response.status,
			ms);
	} catch (error) {
		let end = Date.now();
		let ms =time(start,end);
		// 错误信息开始
		errlogger.error(formatOutput.formatError(ctx,error,ms));
		console.log(chalk.red('%s')
			+ chalk.gray(' -->')
			+ chalk.bold(' %s')
			+ chalk.gray(' res:%s')
			+ chalk.yellow(' %s')
			+ chalk.gray(' %s'),
			(new Date(end)).format('yyyy-MM-dd hh:mm:ss.S'),
			ctx.method,
			JSON.stringify(ctx.body),
			ctx.response.status,
			ms);
	}
});


// 格式化输出  Format output
app.use(async (ctx, next) => {
	try {
		await next();
		/*if (ctx.status != 200) {// system http code
			ctx.throw(ctx.status, ctx.message);
		}*/
	} catch (error) {
		ctx.body = {
			message:error.message,
			details:error.details
		};
		ctx.status = error.status || 503;
		throw error; // ->logs
	}
});

// 登录检查
app.use(accessToken.use);

app.use(koaBody({
	formLimit:"500mb",
	jsonLimit:"5mb",
	textLimit:"1mb",
	//multipart: true,
	// formidable:{
	// 	maxFileSize: 200*1024*1024,
	// 	uploadDir:"files",
	// 	keepExtensions:true,
	// 	onFileBegin:function (name, file) {
	// 		if(file.name){
	// 			let newName = (+new Date()) + "" + parseInt(Math.random()*100);
	// 			let oldName=file.name.substring(0,file.name.lastIndexOf("."));
	// 			let dotName=file.name.replace(oldName,"");
	// 			file.name = oldName+"_"+newName+dotName;//file.name.replace(/.+(?=\.)/,fileName);
	// 			file.path = path.join("files" ,file.name);
	// 		}
	// 	}
	// }
}));




// 加载所有路由 routes
var route = require('./middlewares/routesHelper');
route.init(app);

// 404 url error
app.use(async (ctx, next) => {
	ctx.throw(404, ctx.message,{details:{uri:ctx.request.originalUrl}});
	// await ctx.render('common/404')
});

// error-handling log catch error
app.on('error', (err, ctx) => {
	console.log('server error:', err, ctx);
});

// http 服务
let port = 8020;
const service = http.createServer(app.callback()).listen(port);
service.on('error', (error)=> {
	if (error.syscall !== 'listen') {
		throw error;
	}
	let bind = typeof port === 'string'
		? 'Pipe ' + port
		: 'Port ' + port;
	switch (error.code) {
		case 'EACCES':
			console.error(bind + ' requires elevated privileges');
			process.exit(1);
			break;
		case 'EADDRINUSE':
			console.error(bind + ' is already in use');
			process.exit(1);
			break;
		default:
			throw error;
	}
});
service.on('listening', ()=>{
	let addr = service.address();
	let bind = typeof addr === 'string'
		? 'pipe ' + addr
		: 'port ' + addr.port;
	console.log('the Service is listening on ' + bind);
});

/*
// https 服务
const https = require('https');
// SSL options
let fs = require('fs');
let options = {
	key: fs.readFileSync(__dirname + '/ssl/privatekey.pem'),
	cert: fs.readFileSync(__dirname + '/ssl/certificate.pem')
};
const services = https.createServer(options, app.callback()).listen(1443);
*/
