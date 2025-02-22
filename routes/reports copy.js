
const router = require('koa-router')();
const fs =require('fs');
const path = require('path');
const stream = require('stream');
const rootPath = path.resolve(__dirname, '..').replace(/\\/g,"/");
const userModel = require('../lib/mysql.js');  //数据库接口

router.prefix('/reports');

// 返回详细报告页面1,对外接口，可直接访问详细报告页面，暂时先用起来
router.get('/webPage',  async function (ctx, next) {
	    let query = ctx.request.query;
		// if(query.accessToken != "1k25td5DoFVps"){
		// 	ctx.throw(401);
		// }
	
	    // 提取 query 参数
    	let sqdid = query.sqdid || "";
    	let inpatientid = query.inpatientid || ""; // 添加对 inpatientid 的提取
    	let outpatientid = query.outpatientid || ""; // 添加对 outpatientid 的提取
    	let visitid = query.visitid || ""; // 添加对 orderid 的提取

		let res;
	    let sql="";
	    let value=null;
	    if (sqdid!="")
	    {
	        sql=`SELECT a.name,a.sex,a.age,a.patientid,a.inpatientid,a.outpatientid,b.reqid,b.conclusion,b.bioxreport FROM patient a,report b where a.reqid = b.reqid and a.reqid= ?`;
	        value=[sqdid];
	    }
	    else if (inpatientid != "" || visitid != "")
	    {
	        sql = `SELECT a.patientid,a.name,a.sex,a.age,a.inpatientid,a.outpatientid,c.orderid AS visitid,b.reqid,b.conclusion,b.bioxreport FROM patient a,report b ,orderlist c WHERE a.reqid = b.reqid AND a.inpatientid = ? AND c.orderid = ?`;
	        value = [inpatientid, visitid];
	    }   
	    else if (outpatientid != "" || visitid != ""){
	        sql = `SELECT a.patientid,a.name,a.sex,a.age,a.inpatientid,a.outpatientid,c.orderid AS visitid,b.reqid,b.conclusion,b.bioxreport FROM patient a,report b ,orderlist c WHERE a.reqid = b.reqid AND a.outpatientid = ? AND c.orderid = ?`;
	        value = [outpatientid, visitid];
	    }
	    else
	    {
	        ctx.throw(401, "Parameter error!", {details:{status: "URL ERROR,缺少参数!"}});
	    }
	
	    res=await userModel.query(sql,value);
	    let pdfPath="";
	    let pdfBase64Data="";
	    if(res.length == 0){
	        await ctx.render('webReport', {
	            title:"报告列表",
	            pdfPath:"",
	            pdfBase64Data:"none"
	        });
	        return;
	    }
	    else {
	
	        let pdfPath=res[0].bioxreport;
	        let pdfBase64Data=""; //fs.readFileSync(pdfPath).toString('base64');   //暂停使用
	
	        await ctx.render('webReport', {
	            title:"详细报告",
	            pdfPath:pdfPath,
	            pdfBase64Data:pdfBase64Data
	        });
	
	    }
	
	
	});


// 返回详细报告页面2,对外接口，可直接访问详细报告页面，违反RESTFUL定义规则，暂时先用起来
router.get('/findPage',  async function (ctx, next) {
	let query = ctx.request.query;

	// ctx.assert(query.accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});
	// if(query.accessToken != "1k25td5DoFVps"){
	// 	ctx.throw(401);
	// }

	let patientid="";
	if (query.patientid !== undefined) patientid=query.patientid;
	let sqdid="";
	if (query.sqdid !== undefined) sqdid=query.sqdid;
	let inpatientid="";
	if (query.inpatientid !== undefined) inpatientid=query.inpatientid;
	let outpatientid="";
	if (query.outpatientid !== undefined) outpatientid=query.outpatientid;
	let orderid ="";
	if (query.orderid !== undefined) orderid=query.orderid;

	let selectIdx=0;
	if (query.selectIdx !== undefined) selectIdx=query.selectIdx;

	let res;

	let sql="";
	let value=null;
	let findType="0";
	if (sqdid!="")
	{
		sql=`SELECT a.name,a.sex,a.age,a.patientid,a.inpatientid,a.outpatientid,b.reqid,b.conclusion,b.bioxreport 
		FROM 
			patient a,report b 
		where 
			a.reqid = b.reqid and a.reqid= ?`;
		value=[sqdid];
		findType="0";
	}
	else if (patientid!="")
	{
		sql=`SELECT a.patientid,a.name,a.sex,a.age,a.inpatientid,a.outpatientid,b.reviewDate,b.reqid,b.conclusion,b.bioxreport,c.itemtype 
		FROM
			patient a 
		JOIN
			report b 
			ON a.reqid = b.reqid 
		LEFT JOIN
			orderlist c
			ON a.reqid = c.reqid
		WHERE
			a.patientid= ?;`;
		value=[patientid];
		findType="1";
	}
	else if (inpatientid!="")
	{
		sql=`SELECT a.patientid,a.name,a.sex,a.age,a.inpatientid,a.outpatientid,b.reviewDate,b.reqid,b.conclusion,b.bioxreport,c.itemtype
		FROM 
			patient a
		JOIN
			report b 
			ON a.reqid = b.reqid
		LEFT JOIN
			orderlist c
			ON a.reqid = c.reqid
		WHERE
			a.inpatientid= ?`;
		value=[inpatientid];
		findType="2";
	}
	else if (outpatientid!="")
	{
		sql=`SELECT a.patientid,a.name,a.sex,a.age,a.inpatientid,a.outpatientid,b.reviewDate,b.reqid,b.conclusion,b.bioxreport,c.itemtype
		FROM 
			patient a
		JOIN
			report b 
			ON a.reqid = b.reqid
		LEFT JOIN
			orderlist c
			ON a.reqid = c.reqid
		WHERE
			a.outpatientid= ?`;
		value=[outpatientid];
		findType="3";
	}
	else if (inpatientid != "" || orderid != "")
	{
		sql = `SELECT a.patientid,a.name,a.sex,a.age,a.inpatientid,a.outpatientid,c.orderid,b.reqid,b.conclusion,b.bioxreport 
		FROM 
			patient a,report b ,orderlist c 
		WHERE 
			a.reqid = b.reqid AND a.inpatientid = ? AND c.orderid = ?`;
    	value = [inpatientid, orderid];
    	findType = "4";
	}	
	else if (outpatientid != "" || orderid != ""){
		sql = `SELECT a.patientid,a.name,a.sex,a.age,a.inpatientid,a.outpatientid,c.orderid,b.reqid,b.conclusion,b.bioxreport 
		FROM 
			patient a,report b ,orderlist c 
		WHERE 
			a.reqid = b.reqid AND a.outpatientid = ? AND c.orderid = ?`;
    	value = [outpatientid, orderid];
    	findType = "5";
	}
	else
	{
		ctx.throw(401, "Parameter error!", {details:{status: "URL ERROR,缺少参数!"}});
	}

	res=await userModel.query(sql,value);
	let pdfPath="";
	let pdfBase64Data="";
	if(res.length == 0){
		await ctx.render('webReport', {
			title:"报告列表",
			pdfPath:"",
			pdfBase64Data:"none"
		});
		return;
	}
	else
	{
		if (selectIdx>=0 && selectIdx<res.length)
		{

		}
		else selectIdx=0;
	}

	pdfPath=res[selectIdx].bioxreport;//"c:\\test.pdf";
	pdfBase64Data="";//fs.readFileSync(pdfPath).toString('base64');   //暂停使用

	await ctx.render('webReportMulti', {
			title:"报告列表",
			total:1,
			page:1,
			records:res.count,
			rows:res,
			pdfPath:pdfPath,
			pdfBase64Data:pdfBase64Data,
			searchType:findType
		}
	);
});

// 根据 reqid 获取报告 URL
router.get('/getReportUrl', async (ctx) => {
    const { reqid } = ctx.request.query;

    // 检查 accessToken
    if (ctx.request.query.accessToken !== "1k25td5DoFVps") {
        ctx.throw(401);
    }

    // 检查 reqid 是否提供
    if (!reqid) {
        ctx.throw(400, "Parameter error: reqid is required");
    }

    // 查询 report 表以获取 reporturl
    const sql = `SELECT reporturl FROM report WHERE reqid = ?`;
    const values = [reqid];

    try {
        const result = await userModel.query(sql, values);
        
        if (result.length === 0) {
            ctx.body = { reporturl: null };  // 如果没有结果，返回 null
        } else {
            ctx.body = { reporturl: result[0].bioxreport };  // 返回 reporturl
        }
    } catch (error) {
        ctx.throw(500, "Database error: " + error.message);
    }
});

//直接在界面上显示PDF文件
router.get('/GetPdf', async (ctx) => {
  //const { filename } = ctx.params;
  //const pdfDirectory = path.join(__dirname, 'files'); // 存放PDF文件的目录
  //const pdfFilePath = path.join(pdfDirectory, filename);
  const pdfFilePath = ctx.query.filepath;

  // 检查文件是否存在
  if (fs.existsSync(pdfFilePath)) {
    // 使用Koa提供请求的PDF文件
    ctx.type = 'application/pdf'; // 设置响应类型为PDF
    ctx.body = fs.createReadStream(pdfFilePath); // 发送文件流
  } else {
    ctx.status = 404;
    //ctx.body = 'PDF not found - ' + pdfFilePath;

	let prompt= '未找到该患者报告';
      
	if (pdfFilePath!="") prompt= '未找到该患者报告 - ' + pdfFilePath;
	

    // 在ctx.body中输出HTML内容
	ctx.body = `
	  <html>
		<head>
		  <style>
			body {
			  text-align: center;
			}
			.highlight-text {
			  font-size: 24px;
			  font-weight: bold;
			  color: white; /* 你可以根据需要更改颜色 */
			}
		  </style>
		</head>
		<body>
		  <p class="highlight-text">${prompt}</p>
		</body>
	  </html>
	`;

  }
});

//检查PDF文件状态
router.get('/CheckPdfFile', async (ctx) => {
    const filePath = ctx.query.filepath;
    if (!filePath) {
        ctx.status = 400;
        ctx.body = { error: 'No file path specified' };
        return;
    }

	console.log(filePath);

    const resolvedPath = path.resolve(__dirname, filePath);
    if (fs.existsSync(resolvedPath)) {
        ctx.body = { exists: true };
    } else {
        ctx.body = { exists: false };
    }
});

module.exports = router;