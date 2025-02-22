let accessToken = {
	use: async function (ctx, next) {
		let uri = ctx.url;
		// let reg = new RegExp("(^/users/.*?/login|^/users/.*?/refreshAll)"); //uri = uri.replace(/([\?][^\?]+)$/, "");
		let reg = /(^\/users\/.[^\/]+\/loginPUT|^\/users\/.[^\/]+\/accessTokens|^\/users\/.[^\/]+\/allToken)/;
		let noCheck = reg.test(uri + ctx.method);
		if(noCheck){
			console.log("not check token...");
		}else {
			console.log("check token...");
			/*ctx.state.user = {
				name:"name",
				account:"15052221631",
				img:"image/15052221631.png",
				token:"token"
			};*/
			//ctx.throw(401, 'token fail', { user: 1234});
		}
		return await next();
	}
};
module.exports = accessToken;