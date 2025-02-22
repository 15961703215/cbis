const router = require("koa-router")()
const mime = require('mime-types') //需npm安装
const fs = require('fs')

router.prefix("/pdf")


// Helper function to get file stats (size)
function getFileStats(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve(stats);
      }
    });
  });
}

router.get("/", async (ctx, next) => {
  ctx.body = {
    title: "/api/pdf/",
  }
})

// http://127.0.0.1:8020/api/pdf/Preview?filePath=E:\root\Personal\English\02.pdf
// http://127.0.0.1:8020/api/pdf/Preview?filePath=C:\Users\Reciter\Desktop\1.jpg
router.get('/Preview', async (ctx, next) => {
  // console.info('ctx.request.query', ctx.request.query)
  //let filePath = Object.keys(ctx.request.query)[0]
  let filePath = ctx.request.query.filePath;
  let accessToken=ctx.request.query.accessToken;
  ctx.assert(accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});
  if (accessToken!="1k6728IUvK0PV"){
    ctx.body={
			status: "Error accessToken"
		};
  }else{
    let file = fs.readFileSync(filePath);
    let mimeType = mime.lookup(filePath); //读取图片文件类型
    
    ctx.set('content-type', mimeType);    //设置返回类型
    ctx.body = file; //返回图片
  }
  
  
})

// http://127.0.0.1:8020/api/pdf/Download?filePath=E:\root\Personal\English\02.pdf
// http://127.0.0.1:8020/api/pdf/Download?filePath=C:\Users\Reciter\Desktop\1.jpg
router.get('/Download', async (ctx, next) => {
  let filePath = ctx.request.query.filePath
  console.info('filePath', filePath)
  
  let accessToken=ctx.request.query.accessToken;
  ctx.assert(accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});
  if (accessToken!="1k6728IUvK0PV"){
    ctx.body={
			status: "Error accessToken"
		};
  }else{
  
    //let file = fs.readFileSync(filePath)
    //let fileName = filePath.split('\\').pop()
    //ctx.set('Content-disposition', 'attachment;filename=' + encodeURIComponent(fileName))
    //ctx.body = file //返回图片  

    const fileStats = await getFileStats(filePath);
    ctx.set('Content-disposition', 'attachment; filename=bioxreport.pdf'); // Replace with the desired filename for the downloaded file
    ctx.set('Content-length', fileStats.size);
    ctx.type = 'application/octet-stream';
    ctx.body = fs.createReadStream(filePath);    
    
  }
})

module.exports = router