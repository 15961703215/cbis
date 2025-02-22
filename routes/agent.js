
const router = require('koa-router')()
const userModel = require('../lib/mysql.js');  //数据库接口
router.prefix('/agents');

//提交信息
router.post('/', async function (ctx, next) {
	ctx.body = {};
});

// 添加医疗机构
router.post('/AddAgent',async function (ctx, next) {
	let body = ctx.request.body;
	// 验证参数
	ctx.assert(body.AgentName, 400, "Parameter error!", {details: {AgentName: "undefined"}});
	ctx.assert(body.Contact, 400, "Parameter error!", {details: {Contact: "undefined"}});
	ctx.assert(body.MobilePhone, 400, "Parameter error!", {details: {MobilePhone: "undefined"}});
	ctx.assert(body.Addr, 400, "Parameter error!", {details: {Addr: "undefined"}});

	// 验证 重复输入
	let _sql="";
	let _value="";
	_sql = "select * from agent where AgentName=?;"
	_value=[body.AgentName];

	let res = await userModel.query(_sql,_value);
	if (res.length > 0) {
		ctx.throw(400, "Parameter error!name duplication.");
	} else {

		_sql = "insert into agent set AgentName=?,Contact=?,MobilePhone=?,Addr=?;"
		_value=[body.AgentName,body.Contact,body.MobilePhone,body.Addr];
		let res1 = await userModel.query(_sql,_value);
		ctx.body = {
			rows: res1
		}
	}
});


// 返回所有医疗机构信息
router.get('/AllAgent',  async function (ctx, next) {
	let _sql = "select * from agent;"
	let res = await userModel.query(_sql);
	ctx.body = {
		rows: res
	};
});


// 机构管理页面
router.get('/ManagePage',  async function (ctx, next) {
	await ctx.render('agentmanage', {
		title:"机构管理"
	});
});

//修改数据
router.put('/', async function (ctx, next) {
	ctx.body = {};
});

//修改医疗机构信息
router.put('/:id/name', async function (ctx, next) {
	let body = ctx.request.body;
	ctx.assert(body.AgentName, 400, "Parameter error!", {details: {AgentName: "undefined"}});
	ctx.assert(body.Contact, 400, "Parameter error!", {details: {Contact: "undefined"}});
	ctx.assert(body.MobilePhone, 400, "Parameter error!", {details: {MobilePhone: "undefined"}});
	ctx.assert(body.Addr, 400, "Parameter error!", {details: {Addr: "undefined"}});

	let id = ctx.params.id;
	let _sql="";
	let _value="";
	_sql = "update agent set AgentName=?,Contact=?,MobilePhone=?,Addr=? where _id=?;"
	_value=[body.AgentName,body.Contact,body.MobilePhone,body.Addr,id];
	let res = await userModel.query(_sql,_value);
	ctx.body = {};
});


//删除数据
router.delete('/', async function (ctx, next) {
	ctx.body = {};
});

//删除医疗结构
router.delete('/:id', async function (ctx, next) {
	let id = ctx.params.id;
	let _sql="";
	let _value="";
	_sql = "delete from agent where _id=?;"
	_value=[id];
	let res = await userModel.query(_sql,_value);
	if (res.affectedRows>0){
		ctx.body = {};
	}
	else {
		ctx.throw(401);
	}
});

module.exports = router;