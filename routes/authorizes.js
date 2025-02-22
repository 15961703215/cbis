const router = require('koa-router')()
const userModel = require('../lib/mysql.js');  //数据库接口


router.prefix('/authorizes');

// 返回所有权限信息
router.get('/AllAuth',  async function (ctx, next) {
    let res = await userModel.AllAuth();
    ctx.body = {
        rows: res
    };
});

module.exports = router;