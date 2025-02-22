let Service = require('node-windows').Service;



let svc = new Service({

  name: 'bioxCBISServer',    //服务名称

  description: 'bioxCBISServer', //描述

  script: 'E:\workarea\CBIS\SOFTWARE\SERVER\app.js'   //nodejs项目要启动的文件路径

});


svc.on('uninstall', function(){

  console.log('uninstall complete.');
  console.log('the service exists:',svc.exists);
});


svc.uninstall();
