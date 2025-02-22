
const router = require('koa-router')()
const userModel = require('../lib/mysql.js');  //数据库接口
router.prefix('/roles');

//提交信息
router.post('/', async function (ctx, next) {
	ctx.body = {};
});

// 添加完整用户
router.post('/AddRole',async function (ctx, next) {
	let body = ctx.request.body;
	// 验证参数
	ctx.assert(body.name, 400, "Parameter error!",{details:{ name: "undefined"}});
	ctx.assert(body.aut, 400, "Parameter error!",{details:{ aut: "undefined"}});

	// 验证 重复输入
	let res = await userModel.findRole(body.name);
	if (res.length > 0) {
		ctx.throw(400, "Parameter error!name duplication.");
	} else {
		let aut = [1, 2, 3, 4, 5, 6, 7, 8, 9];
		let start = Date.now();
		let res1 = await userModel.insertRole([body.name, aut]);
		ctx.body = {
			rows: res1
		}
	}
});

// 添加简易角色
router.post('/AddExpressRole',async function (ctx, next) {
	let body = ctx.request.body;
	// 验证参数
	ctx.assert(body.name, 400, "Parameter error!",{details:{ name: "undefined"}});

	// 验证 重复输入
	let res = await userModel.findRole(body.name);
	if (res.length > 0) {
		ctx.throw(400, "Parameter error!name duplication.");
	} else {
		let aut = '[4, 6, 8, 9]';
		let start = Date.now();
		let res1 = await userModel.insertRole([body.name, aut]);
		ctx.body = {
			rows: res1
		}
	}
});

// 返回所有用户信息
router.get('/AllRole',  async function (ctx, next) {
	let res = await userModel.AllRole();
	ctx.body = {
		rows: res
	};
});



// 角色管理页面
router.get('/ManagePage',  async function (ctx, next) {
	await ctx.render('rolemanage', {
		title:"用户管理"
	});
});

//修改用户数据
router.put('/', async function (ctx, next) {
	ctx.body = {};
});

//修改角色名称
router.put('/:id/name', async function (ctx, next) {
	let body = ctx.request.body;
	ctx.assert(body.name, 400, "Parameter error!", {details: {Name: "undefined"}});
	let id = ctx.params.id;
	await userModel.updateRoleName([body.name, id]);

	ctx.body = {};
});

//修改角色权限
router.put('/:id/auth', async function (ctx, next) {
	let body = ctx.request.body;
	ctx.assert(body.authID, 400, "Parameter error!",{details:{ authID: "undefined"}});
	ctx.assert(body.authValue, 400, "Parameter error!",{details:{ authValue: "undefined"}});
	let roleID = ctx.params.id;
	let res = await userModel.findRoleByID(roleID);
	if (res.length > 0) {
		let aut = {auths: JSON.parse(res[0].aut)};
		let find = false;
		let findIdx = -1;
		for (let i = 0; i < aut.auths.length; i++) {
			if (aut.auths[i] == Number(body.authID)) {
				findIdx = i;
				find = true;
				break;
			}
		}

		if (Number(body.authValue) == 1) {    //添加一项权限
			if (!find) {
				aut.auths.push(Number(body.authID));
			}
		} else {   //删除一个权限
			if (find && findIdx >= 0) {
				aut.auths.splice(findIdx, 1);
			}
		}

		let autStr = JSON.stringify(aut.auths);
		await userModel.updateRoleAuth([autStr, roleID]);
		ctx.body = {};
	} else {
	}
});

//删除数据
router.delete('/', async function (ctx, next) {
	ctx.body = {};
});
//删除角色
router.delete('/:id', async function (ctx, next) {
	let id = ctx.params.id;

	let _sql="";
	let _value="";
	_sql = "delete from role where _id=?;"
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