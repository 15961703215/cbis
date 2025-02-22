const router = require('koa-router')();
const svgCaptcha = require('svg-captcha')


router.get('/', async (ctx, next) => {
	var header =ctx.header;
	var query = ctx.request.query;
	await ctx.render('index', {
		title:"报告管理系统"
	});
	return;
	/*ctx.body={};
	ctx.status =200;
	return;*/
	// ctx.assert(ctx.state.user, 400, ctx.state.ApiError.getMessage(ctx.state.ApiError.DATA_TEMPTY),{user:""});
	//ctx.throw(401, 'name required', { user: 1234});
	/*
	// http status
	ctx.status =401;
	return;
	*/
	
	/*
	// ------------custom error------------
	var error = new Error("no...");
	error.name="kkkk";
	error.status = 1000;
	throw error;
	*/
	//  ----------------run error and third error-----------
	ctx.body = await ctx.state.redis.hgetalll("device:822938295","ee");
	// -----------ok-------------
    ctx.body = {
       message:"success"
    };
   // throw new Error("no");
	/*await ctx.render('index', {
		title:"API REST server"
	});*/
    // ------log------------
	console.log(`${ctx.method} ${ctx.url} ctx.response.status: ${ctx.response.status}`);
});

router.get('/string', async (ctx, next) => {
	ctx.body = 'koa2 string';
});

router.get('/json', async (ctx, next) => {
  ctx.body = {
    title: 'koa2 json'
  };
});

// 获取验证码
router.get('/Captcha', async (ctx, next) => {

	const cap = svgCaptcha.create({
		size: 4, // 验证码长度
		width:278,
		height:60,
		fontSize: 50,
		ignoreChars: '0oO1ilI', // 验证码字符中排除 0o1i
		noise: 2, // 干扰线条的数量
		color: true, // 验证码的字符是否有颜色，默认没有，如果设定了背景，则默认有
		background: '#eee' // 验证码图片背景颜色
	})

	let img = cap.data // 验证码
	let text = cap.text.toLowerCase() // 验证码字符，忽略大小写

	ctx.session.captcha=text;
	// 设置响应头
	ctx.response.type = 'image/svg+xml';
	ctx.body = img;


	//ctx.req.session.captcha = cap.text.toLowerCase() ;  //将验证码文本存进session
	//ctx.res.type('svg').send(cap.data);

});



module.exports = router;
