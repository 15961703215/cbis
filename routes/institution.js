
const router = require('koa-router')()
const userModel = require('../lib/mysql.js');  //数据库接口
router.prefix('/institutions');

//提交信息
router.post('/', async function (ctx, next) {
	ctx.body = {};
});

// 添加医疗机构
router.post('/AddInstitution',async function (ctx, next) {
	let body = ctx.request.body;
	// 验证参数
	ctx.assert(body.name, 400, "Parameter error!", {details: {AgentName: "undefined"}});
	ctx.assert(body.phone, 400, "Parameter error!", {details: {MobilePhone: "undefined"}});
	ctx.assert(body.addr, 400, "Parameter error!", {details: {Addr: "undefined"}});
	ctx.assert(body.des, 400, "Parameter error!", {details: {Contact: "undefined"}});

	// 验证 重复输入
	let _sql="";
	let _value="";
	_sql = "select * from institution where name=?;"
	_value=[body.name];

	let res = await userModel.query(_sql,_value);
	if (res.length > 0) {
		ctx.throw(400, "Parameter error!name duplication.");
	} else {

		_sql = "insert into institution set name=?,phone=?,addr=?,des=?;"
		_value=[body.name,body.phone,body.addr,body.des];
		let res1 = await userModel.query(_sql,_value);
		ctx.body = {
			rows: res1
		}
	}
});


// 返回所有医疗机构信息
router.get('/AllInstitution',  async function (ctx, next) {
	let _sql = "select * from institution;"
	let res = await userModel.query(_sql);
	ctx.body = {
		rows: res
	};
});


// 机构管理页面
router.get('/ManagePage',  async function (ctx, next) {
	await ctx.render('institutionmanage', {
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
	ctx.assert(body.name, 400, "Parameter error!", {details: {AgentName: "undefined"}});
	ctx.assert(body.phone, 400, "Parameter error!", {details: {MobilePhone: "undefined"}});
	ctx.assert(body.addr, 400, "Parameter error!", {details: {Addr: "undefined"}});
	ctx.assert(body.des, 400, "Parameter error!", {details: {Contact: "undefined"}});

	let id = ctx.params.id;
	let _sql="";
	let _value="";
	_sql = "update institution set name=?,phone=?,addr=?,des=? where _id=?;"
	_value=[body.name,body.phone,body.addr,body.des,id];
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
	_sql = "delete from institution where _id=?;"
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