
const router = require('koa-router')()
const userModel = require('../lib/mysql.js');  //数据库接口
router.prefix('/hosps');

//提交信息
router.post('/', async function (ctx, next) {
	ctx.body = {};
});

// 添加完整医院信息
router.post('/AddHosp',async function (ctx, next) {
	let body = ctx.request.body;
	// 验证参数
	ctx.assert(body.hospName, 400, "Parameter error!",{details:{ hospName: "undefined"}});
	ctx.assert(body.Area, 400, "Parameter error!",{details:{ Area: "undefined"}});
	ctx.assert(body.Contact, 400, "Parameter error!",{details:{ Contact: "undefined"}});
	ctx.assert(body.Phone, 400, "Parameter error!",{details:{ Phone: "undefined"}});
	ctx.assert(body.Addr, 400, "Parameter error!",{details:{ Addr: "undefined"}});

	// 验证 重复输入

	let _sql="";
	let _value="";

	_sql = "select * from hospital where hospName=?;"
	_value=[body.name];

	let res = await userModel.query(_sql,_value);
	if (res.length > 0) {
		ctx.throw(400, "Parameter error!name duplication.");
	} else {

		_sql = "insert into hospital set hospName=?,Area=?,Contact=?,MobilePhone=?,Phone=?,Addr=?,Institutionid=?,Agentid=?;"
		_value=[body.hospName,body.Area,body.Contact,body.Phone,body.Phone,body.Addr,0,0];
		let res1 = await userModel.query(_sql,_value);
		ctx.body = {
			rows: res1
		}
	}
});

// 添加简易医院名称
router.post('/AddExpressHosp',async function (ctx, next) {
	let body = ctx.request.body;
	// 验证参数
	ctx.assert(body.hospName, 400, "Parameter error!",{details:{ hospName: "undefined"}});
	ctx.assert(body.Phone, 400, "Parameter error!",{details:{ Phone: "undefined"}});
	ctx.assert(body.Addr, 400, "Parameter error!",{details:{ Addr: "undefined"}});

	// 验证 重复输入
	let _sql="";
	let _value="";
	_sql = "select * from hospital where hospName=?;"
	_value=[body.name];

	let res = await userModel.query(_sql,_value);
	if (res.length > 0) {
		ctx.throw(400, "Parameter error!name duplication.");
	} else {
		_sql = "insert into hospital set hospName=?,Area=?,Contact=?,MobilePhone=?,Phone=?,Addr=?,Institutionid=?,Agentid=?;"
		_value=[body.hospName,"","","",body.Phone,body.Addr,0,0];
		let res1 = await userModel.query(_sql,_value);
		ctx.body = {
			rows: res1
		}
	}
});

// 返回所有医院信息
router.get('/AllHosp',  async function (ctx, next) {
	let _sql = "select * from hospital;"
	let res = await userModel.query(_sql);
	ctx.body = {
		rows: res
	};
});



// 医院管理页面
router.get('/ManagePage',  async function (ctx, next) {
	await ctx.render('hospmanage', {
		title:"医院管理"
	});
});

//修改医院数据
router.put('/', async function (ctx, next) {
	ctx.body = {};
});

//修改医院名称
router.put('/:id/name', async function (ctx, next) {
	let body = ctx.request.body;
	ctx.assert(body.hospName, 400, "Parameter error!",{details:{ hospName: "undefined"}});
	ctx.assert(body.Phone, 400, "Parameter error!",{details:{ Phone: "undefined"}});
	ctx.assert(body.Addr, 400, "Parameter error!",{details:{ Addr: "undefined"}});
	let id = ctx.params.id;

	let _sql="";
	let _value="";
	_sql = "update hospital set hospName=?,Phone=?,Addr=? where _id=?;"
	_value=[body.hospName,body.Phone,body.Addr,id];
	let res = await userModel.query(_sql,_value);

	ctx.body = {};
});

//修改医疗机构
router.put('/:id/Institution', async function (ctx, next) {
	let body = ctx.request.body;
	ctx.assert(body.Institution, 400, "Parameter error!",{details:{ Name: "undefined"}});
	let id = ctx.params.id;

	let _sql="";
	let _value="";
	_sql = "update hospital set Institutionid=? where _id=?;"
	_value=[body.Institution,id];
	let res = await userModel.query(_sql,_value);
	ctx.body = {};
});


//删除数据
router.delete('/', async function (ctx, next) {
	ctx.body = {};
});

//删除医院
router.delete('/:id', async function (ctx, next) {
	let id = ctx.params.id;
	let _sql="";
	let _value="";
	_sql = "delete from hospital where _id=?;"
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