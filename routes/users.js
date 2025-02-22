
const router = require('koa-router')();
const md5 = require("../middlewares/md5");
var os =require('os');
var path = require('path');
var fs =require('fs');
const ShortId =require("jsshortid-helper");
const shortId =new ShortId();
const accessDuration = 1000*60*60*24*1; // 1 天
const refreshDuration = 1000*60*60*24*7;  //7 天
const urlib = require("url");

const userModel = require('../lib/mysql.js');  //数据库接口

router.prefix('/users');


//提交信息
router.post('/', async function (ctx, next) {
	ctx.body = {};
});

// 添加完整用户
router.post('/AddUser',async function (ctx, next) {
	let body = ctx.request.body;
	// 验证参数
	ctx.assert(body.account, 400, "Parameter error!",{details:{ account: "undefined"}});
	ctx.assert(body.name, 400, "Parameter error!",{details:{ name: "undefined"}});
	ctx.assert(body.password, 400, "Parameter error!",{details:{ name: "undefined"}});

	// 验证 重复输入
	let res = await userModel.findUser(body.account);
	if (res.length > 0) {
		ctx.throw(400, "Parameter error!Account duplication.");
	} else {
		let pass = md5.hex_md5(body.password);
		let start = Date.now();
		let res1 = await userModel.insertUser([body.account, pass, body.name, '2222', '333']);
		ctx.body = {
			rows: res1
		}
	}
});

// 添加简易用户（带入帐号名称和姓名，其他都使用默认值）
router.post('/AddExpressUser',async function (ctx, next) {
	let body = ctx.request.body;
	// 验证参数
	ctx.assert(body.Account, 400, "Parameter error!", {details: {account: "undefined"}});
	ctx.assert(body.Name, 400, "Parameter error!", {details: {name: "undefined"}});

	// 验证 重复输入
	let res = await userModel.findUser(body.Account);
	if (res.length > 0) {
		ctx.throw(400, "Parameter error!Account duplication.");
	} else {
		let pass = md5.hex_md5("biox@123456");
		let start = Date.now();

		let res1 = await userModel.insertUser([body.Account, pass, body.Name, '2222', 2]);
		ctx.body = {
			rows: res1
		}
	}
});


// 用户登录
router.post('/ValidAccessToken',async function (ctx, next) {
	let body = ctx.request.body;
	// 验证参数
	ctx.assert(body.accessToken, 400, "Parameter error!",{details:{ username: "undefined"}});

	let res = await userModel.findAccessToken(body.accessToken);
	let bValid=false;
	if (res.length > 0) {
		let accessTime = (+new Date());
		if (accessTime<res[0].accessTime) bValid=true;
	}

	if (bValid){
		ctx.body = {
			status: "successful"
		};

	}else {
		ctx.body = {
			status: "failed"
		};

	}
});

// 用户登录
router.post('/Login',async function (ctx, next) {
	let body = ctx.request.body;
	// 验证参数
	ctx.assert(body.username, 400, "Parameter error!",{details:{ username: "undefined"}});
	ctx.assert(body.password, 400, "Parameter error!",{details:{ password: "undefined"}});
	let pass = md5.hex_md5(body.password);


	let failCount=0;
	let time=Date.now();
	let _sql = "select * from user where Account=?"
	let _value=[body.username];
	let resTmp= await userModel.query(_sql,_value);
	if (resTmp.length>0){
		failCount=resTmp[0].LoginFailCount;
		let LonginDate=resTmp[0].LoginDate;
		if (LonginDate!=null && failCount!=null && LonginDate.toLocaleDateString() == (new Date(time)).toLocaleDateString() && failCount>=6){
			ctx.throw(400, "Login failed. You have tried too many times. Please try again tomorrow!", {details: {u: body.u}});
		}else if (LonginDate!=null && LonginDate.toLocaleDateString() != (new Date(time)).toLocaleDateString()){
			_sql = "update user set LoginDate=?, LoginFailCount=? where Account=?";
			_value=[new Date(time),0,body.username];
			await userModel.query(_sql,_value);
		}
	}else{
		ctx.throw(400, "User not Exist or Password Error!", {details: {u: body.u}});
	}

	let res = await userModel.Login([body.username, pass]);
	if (res.length > 0) {
		await userModel.deleteAccessToken([body.username, pass]);
		let accessToken = shortId.gen(13);
		let refreshToken = shortId.gen(13);
		let accessTime = (+new Date()) + accessDuration;
		let refreshTime = (+new Date()) + refreshDuration;
		let resAccess = await userModel.insertAccessToken([body.username, accessToken, refreshToken, accessTime, refreshTime]);
		let authorizes = [];
		let roleID = res[0].Role;
		let resRol = await userModel.findRoleByID(roleID);
		if (resRol.length > 0) {
			let roleValue = {auths: JSON.parse(resRol[0].aut)};
			authorizes = roleValue.auths;
		}
		//成功登录后，写入相关登录信息到数据库
		_sql = "update user set LoginDate=?, LastLoginDate=?, LoginFailCount=? where Account=?"
		_value=[new Date(time),new Date(time),0,body.username];
		await userModel.query(_sql,_value);

		ctx.body = {
			result: 1,
			accessToken: accessToken,
			refreshToken: refreshToken,
			accessTime:accessTime,
			name: res[0].Name,
			authorizes: authorizes
		};


	} else {

		failCount=failCount+1;
		_sql = "update user set LoginDate=?, LoginFailCount=? where Account=?"
		_value=[new Date(time),failCount,body.username];
		await userModel.query(_sql,_value);

		ctx.throw(400, "User not Exist or Password Error!", {details: {u: body.u}});
	}
});

// 用户登录
router.post('/WebLogin',async function (ctx, next) {
	let body = ctx.request.body;
	// 验证参数
	ctx.assert(body.username, 400, "Parameter error!",{details:{ username: "undefined"}});
	ctx.assert(body.password, 400, "Parameter error!",{details:{ password: "undefined"}});
	ctx.assert(body.verifycode, 400, "Parameter error!",{details:{ verifycode: "undefined"}});
	let pass = md5.hex_md5(body.password);

	if (body.verifycode!=ctx.session.captcha)
	{
		ctx.throw(401, "Verifycode error!", {details: {vefifycode:body.verifycode}});
	}

	let failCount=0;
	let time=Date.now();
	let _sql = "select * from user where Account=?"
	let _value=[body.username];
	let resTmp= await userModel.query(_sql,_value);
	if (resTmp.length>0){
		failCount=resTmp[0].LoginFailCount;
		let LonginDate=resTmp[0].LoginDate;
		if (LonginDate!=null && failCount!=null && LonginDate.toLocaleDateString() == (new Date(time)).toLocaleDateString() && failCount>=6){
			ctx.throw(402, "Login failed. You have tried too many times. Please try again tomorrow!", {details: {u: body.u}});
		}else if (LonginDate!=null && LonginDate.toLocaleDateString() != (new Date(time)).toLocaleDateString()){
			_sql = "update user set LoginDate=?, LoginFailCount=? where Account=?";
			_value=[new Date(time),0,body.username];
			await userModel.query(_sql,_value);
		}
	}else{
		ctx.throw(400, "User not Exist or Password Error!", {details: {u: body.u}});
	}

	let res = await userModel.Login([body.username, pass]);
	if (res.length > 0) {
		await userModel.deleteAccessToken([body.username, pass]);
		let accessToken = shortId.gen(13);
		let refreshToken = shortId.gen(13);
		let accessTime = (+new Date()) + accessDuration;
		let refreshTime = (+new Date()) + refreshDuration;
		let resAccess = await userModel.insertAccessToken([body.username, accessToken, refreshToken, accessTime, refreshTime]);
		let authorizes = [];
		let roleID = res[0].Role;
		let resRol = await userModel.findRoleByID(roleID);
		if (resRol.length > 0) {
			let roleValue = {auths: JSON.parse(resRol[0].aut)};
			authorizes = roleValue.auths;
		}

		//成功登录后，写入相关登录信息到数据库
		_sql = "update user set LoginDate=?, LastLoginDate=?, LoginFailCount=? where Account=?";
		_value=[new Date(time),new Date(time),0,body.username];
		await userModel.query(_sql,_value);


		ctx.body = {
			result: 1,
			accessToken: accessToken,
			refreshToken: refreshToken,
			accessTime:accessTime,
			name: res[0].Name,
			authorizes: authorizes
		};


	} else {

		failCount=failCount+1;
		_sql = "update user set LoginDate=?, LoginFailCount=? where Account=?";
		_value=[new Date(time),failCount,body.username];
		await userModel.query(_sql,_value);

		ctx.throw(400, "User not Exist or Password Error!", {details: {u: body.u}});
	}
});

// 用户注销
router.post('/logout',async function (ctx, next) {
	let body = ctx.request.body;
	// 验证参数
	ctx.assert(body.accessToken, 400, "Parameter error!",{details:{accessToken: "undefined"}});

	let res=await userModel.findAccessToken(body.accessToken);
	if (res.length > 0) {
		userModel.deleteAccessToken(res[0].Account);
	}
	ctx.body = {};
});

// 返回所有用户信息
router.get('/AllUser',  async function (ctx, next) {

	let url=ctx.req.url;
	let params = urlib.parse(url, true).query;
	ctx.assert(params.accessToken, 400, "Parameter error!",{details:{accessToken: "undefined"}});
	if (params.accessToken=="abcd"){
		let res = await userModel.AllUser();
		ctx.body = {
			rows: res
		};
	}else{
		let res = await userModel.AllUser();
		ctx.body = {

		};
	}


});

// 用户登录页面
router.get('/loginPage',  async function (ctx, next) {
	await ctx.render('login', {
		title:"用户登录"
	});
});
// 用户修改密码页面
router.get('/changePassPage',  async function (ctx, next) {
	await ctx.render('changePass', {
		title:"用户修改密码"
	});
});
// 用户管理页面
router.get('/ManagePage',  async function (ctx, next) {
	await ctx.render('usermanage', {
		title:"用户管理"
	});
});

//修改用户数据
router.put('/', async function (ctx, next) {
	ctx.body = {};
});

// 修改密码
router.put('/:id/password', async function (ctx, next) {
	let body = ctx.request.body;
	ctx.assert(body.newPass, 400, "Parameter error!",{details:{ newPass: "undefined"}});
	let accessToken = ctx.params.id;

	let res = await userModel.findAccessToken(accessToken);
	if (res.length > 0) {
		let account = res[0].Account;
		let pass = md5.hex_md5(body.newPass);
		let res1 = await userModel.updateUserPassword([pass, account]);
		ctx.body = res1;
	} else {
		ctx.throw(400);
	}
});

//修改姓名
router.put('/:id/name', async function (ctx, next) {
	let body = ctx.request.body;
	ctx.assert(body.Name, 400, "Parameter error!",{details:{ Name: "undefined"}});
	let account = ctx.params.id;
	let res = await userModel.updateUserName([body.Name, account]);
	ctx.body = {};
});

//修改角色
router.put('/:id/role', async function (ctx, next) {
	let body = ctx.request.body;
	ctx.assert(body.Role, 400, "Parameter error!",{details:{ Name: "undefined"}});
	let account = ctx.params.id;
	let res = await userModel.updateUserRole([body.Role, account]);
	ctx.body = {};
});

//修改医院
router.put('/:id/hosp', async function (ctx, next) {
	let body = ctx.request.body;
	ctx.assert(body.Hosp, 400, "Parameter error!",{details:{ Name: "undefined"}});
	let account = ctx.params.id;

	let _sql="";
	let _value="";
	_sql = "update user set Hospid=? where Account=?;"
	_value=[body.Hosp,account];
	let res = await userModel.query(_sql,_value);

	ctx.body = {};
});



//

//删除数据
router.delete('/', async function (ctx, next) {
	ctx.body = {};
});
//删除用户
router.delete('/:id', async function (ctx, next) {
	let id = ctx.params.id;
	let res = await userModel.deleteUserByID(id);
	ctx.body = {};
});

module.exports = router;