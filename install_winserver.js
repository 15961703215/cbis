let Service = require('node-windows').Service;


let path = require('path');


let svc = new Service({

  name: 'bioxCBISServer',    //��������

  description: 'bioxCBISServer', //����

  script: 'D:\work\cbis\app.js'   //nodejs��ĿҪ�������ļ�·��

});


svc.on('install', () => {

  svc.start();

});


svc.install();
