/**
 * 动态遍历目录加载路由工具
 * author: bling兴哥
 */
var fs = require("fs");
var path = require('path');

// 动态路由
var loadRoute = {
	path: 'routes/',
	app: null,
	// 遍历目录
	listDir: function (dir) {
		var fileList = fs.readdirSync(dir, 'utf-8');
		for (var i = 0; i < fileList.length; i++) {
			var stat = fs.lstatSync(dir + fileList[i]);
			// 是目录，需要继续
			if (stat.isDirectory()) {
				this.listDir(dir + fileList[i] + '/');
			} else {
				this.loadRoute(dir + fileList[i]);
			}
		}
	},
	// 加载路由
	loadRoute: function (routeFile) {
		var route = require(routeFile.substring(0, routeFile.lastIndexOf('.')));
		this.app.use(route.routes(), route.allowedMethods());
	},
	// 初始化入口
	init: function (app, routesPath) {
		if (!app) {
			console.error("系统主参数App未设置");
			return false;
		}
		this.app = app;
		this.path = routesPath ? routesPath : this.path;
		this.listDir(path.resolve(__dirname, '..') + "/" +this.path);
	}
};

module.exports = loadRoute;