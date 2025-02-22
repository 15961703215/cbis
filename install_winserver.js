let Service = require('node-windows').Service;


let path = require('path');


let svc = new Service({

  name: 'bioxCBISServer',    //服务名称

  description: 'bioxCBISServer', //描述

  script: 'D:\work\cbis\app.js'   //nodejs项目要启动的文件路径

});


svc.on('install', () => {

  svc.start();

});


svc.install();
