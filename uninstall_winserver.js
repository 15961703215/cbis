let Service = require('node-windows').Service;



let svc = new Service({

  name: 'bioxCBISServer',    //��������

  description: 'bioxCBISServer', //����

  script: 'E:\workarea\CBIS\SOFTWARE\SERVER\app.js'   //nodejs��ĿҪ�������ļ�·��

});


svc.on('uninstall', function(){

  console.log('uninstall complete.');
  console.log('the service exists:',svc.exists);
});


svc.uninstall();
