const router = require('koa-router')();
const md5 = require("../middlewares/md5");
var os =require('os');
var path = require('path');
var fs =require('fs');
var crypto = require('crypto');
const ShortId =require("jsshortid-helper");
const SparkMD5 = require('spark-md5');
const multiparty = require('multiparty');
const formidable = require('formidable');

const dbLogFile = global.dbLogger;//require('../middlewares/dbLogHelper');

const Json2csvParser = require('json2csv').Parser;
var iconv = require('iconv-lite');

const shortId =new ShortId();
const accessDuration = 1000*60*60*24*1; // 1 天
const refreshDuration = 1000*60*60*24*7;  //7 天

const userModel = require('../lib/mysql.js');  //数据库接口

const UPLOAD_PATH = path.resolve(__dirname, '..').replace(/\\/g,"/")+'/files';


const DLL_PATH = path.resolve(__dirname, '..').replace(/\\/g,"/")+'/lib';
const bioxcvt = require('../build/Release/addon');

//console.log('This should be eight:', bioxcvt.bgtopdf(DLL_PATH,UPLOAD_PATH+'/20210820142340831_anareport.bg',UPLOAD_PATH+'/20210820142340831_anareport.PDF', 50));//结果为8

const isOnlyReportMode=false;

// function
Date.prototype.format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1, //月份
        "d+": this.getDate(), //日
        "h+": this.getHours(), //小时
        "s+": this.getSeconds(), //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "m+": this.getMinutes(), //分
        "S": this.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
};


const isPDFFile=function isPDF(filePath) {

    const buffer = Buffer.alloc(4); // 读取文件的前4个字节
    const fileDescriptor = fs.openSync(filePath, 'r');
    fs.readSync(fileDescriptor, buffer, 0, 4, 0);
    fs.closeSync(fileDescriptor);

    // PDF 文件的魔术数字是 '%PDF'
    const magicNumber = buffer.toString('hex');
    return magicNumber === '25504446'; // 对应的十六进制表示为 '%PDF'
}

const isJson=function IsJSON(str) {
    return new Promise((resolve, reject) => {

        if (typeof str == 'string') {
            try {
                var obj=JSON.parse(str);
                if(typeof obj == 'object' && obj ){
                    resolve(true);
                }else{
                    resolve(false);
                }
            } catch(e) {
                resolve(false);
            }
        }else if (typeof str == 'object'){
            resolve(true);
        }else {
            resolve(false);
        }
    })
};


//设置病例状态
const SetCaseStatus = function CaseStatus(account,recordid,datatype,statvalue) {
    return new Promise(async(resolve, reject) => {
        let res1=await userModel.query("select * from patient where recordid=?",[recordid]);
        if (res1.length<=0){
           resolve(false);
           return;
        }
        let time=Date.now();
        let _sql="";
        let value="";
        if (datatype=="uploaddat"){   //上传数据
            _sql="update Patient set datstatus=?,datuploader=?,datuploaddate=? where recordid=?";
            value=[statvalue,account,new Date(time),recordid];
        } else if (datatype=="downloaddat"){  //下载数据
            _sql="update Patient set datlocked=?,datdownloader=?,datdownloaddate=?,anastatus=0 where recordid=?";
            value=[statvalue,account,new Date(time),recordid];
            if (res1[0].anastatus!=0 || res1[0].datlocked!=0) //数据正在分析或已分析完成则不需要更新状态
            {
                _sql="";
                value="";
            }
        } else if (datatype=="uploadana"){  //上传分析数据
            _sql="update Patient set anastatus=?,anauploader=?,anauploaddate=?,datlocked=0 where recordid=?";
            value=[statvalue,account,new Date(time),recordid];
        } else if (datatype=="downloadana"){  //下载分析数据
            _sql="update Patient set analocked=?,anadownloader=?,anadownloaddate=?,reviewstatus=0 where recordid=?";
            value=[statvalue,account,new Date(time),recordid];

            if (res1[0].reviewstatus!=0 || res1[0].analocked!=0) //数据正在审核或已审核完成则不需要更新状态
            {
                _sql="";
                value="";
            }

        } else if (datatype=="uploadreview"){  //上传审核结果
            _sql="update Patient set reviewstatus=?,reviewuploader=?,reviewuploaddate=?,analocked=0,datlocked=0 where recordid=?";
            value=[statvalue,account,new Date(time),recordid];
        } else if (datatype=="uploadreport"){  //上传报告
            //_sql="update Patient set reviewstatus=?,reviewuploader=?,reviewuploaddate=?,analocked=0 where recordid=?";
            //value=[statvalue,account,new Date(time),recordid];
        }

        if (_sql!="" &&　value!="") {

            console.log(_sql+value);
            let res2=await userModel.query(_sql,value);
            resolve(true);
        }
        else {
            resolve(false);
        }
    });
}

//检测文件是否已经存在
const exists = function exists(path) {
    return new Promise((resolve, reject) => {
        fs.access(path, fs.constants.F_OK, err => {
            if (err) {
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
}

//返回文件长度及MD5值
const retriveFileInfo = function retriveFileInfo(filepath) {
    return new Promise((resolve, reject) => {
        let buffer = fs.readFileSync(filepath);
        let fsHash = crypto.createHash('md5');
        fsHash.update(buffer);
        let md5 = fsHash.digest('hex');
        let filesize = buffer.length;

        resolve({
            md5,
            filesize
        });
    });
}

//利用multiparty插件解析前端传来的form-data格式的数据，并上传至服务器
const multipartyUpload = function multipartyUpload(req, autoUpload) {
    let config = {
        maxFieldsSize: 200 * 1024 * 1024
    }
 //   if (autoUpload) config.uploadDir = SERVER_PATH;

    return new Promise((resolve, reject) => {
        new multiparty.Form(config).parse(req, (err, fields, files) => {
            if (err) {
                reject(err);
                return;
            }
            resolve({
                fields,
                files
            });
        });
    });
}

//检测accessToken是否合法
const  GetValidAccessToken = function ValidAccessToken(accessToken) {
    return new Promise(async(resolve, reject) => {
        let valid=false;
        let res = await userModel.findAccessToken(accessToken);
        if (res.length > 0) {
            let accessTime = (+new Date());
            let maxTime = parseInt(res[0].accessTime);
            if (accessTime <= maxTime) {
               valid=true;
            }
        }

        if (valid) {
            resolve(res);
        }
        else {
            res="";
            resolve(res);
        }
    });
}


router.prefix('/clients');

//提交信息
router.post('/', async function (ctx, next) {
    ctx.body = {};
});

// 用户登录
router.post('/Login',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.username, 400, "Parameter error!",{details:{ username: "undefined"}});
    ctx.assert(body.password, 400, "Parameter error!",{details:{ password: "undefined"}});
    let pass = md5.hex_md5(body.password);
    

    if (body.clientid !== undefined && body.clientid==="reportonly") {
      if (!isOnlyReportMode){ 
            ctx.throw(401, "Parameter error!", {details: "error cbis server, Expected a report version of the CBIS, please contact administrator"});
         } 
    }
    else if (body.clientid !== undefined && body.clientid===""){
      if (isOnlyReportMode){ 
            ctx.throw(401, "Parameter error!", {details: "error cbis server, Expected a data and report version of CBIS, please contact administrator"});
         }   
    }

    let res = await userModel.Login([body.username, pass]);
    if (res.length > 0) {
        await userModel.deleteAccessToken(body.username);
        let accessToken = shortId.gen(13);
        let refreshToken = shortId.gen(13);
        let accessTime = (+new Date()) + accessDuration;
        let refreshTime = (+new Date()) + refreshDuration;
        let resAccess = await userModel.insertAccessToken([body.username, accessToken, refreshToken, accessTime, refreshTime]);
        let authorizes = [];
        let roleID = res[0].Role;
        let resRol = await userModel.findRoleByID(roleID);
        if (resRol.length > 0) {
            let roleValue = {auths: JSON.parse(resRol[0].aut)};
            authorizes = roleValue.auths;
        }
        ctx.body = {
            status: "success",
            accessToken: accessToken,
            accessTime:accessTime,
            auths: authorizes,
            account:body.username
        };
    } else {
        ctx.throw(401, "Parameter error!", {details: "error account or password"});
    }
});

// 用户注销
router.post('/logout',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.accessToken, 400, "Parameter error!", {details: {accessToken: "undefined"}});
    let res = await userModel.findAccessToken(body.accessToken);
    if (res.length > 0) {
        let res1 = await userModel.deleteAccessToken(res[0].Account);
        ctx.body = {
            status: "successful"
        };
    } else {
        ctx.throw(401, "Parameter error!", {details: {status: "not authenticated"}});
    }
});

//信息登记
router.post('/AddPatient',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});
    ctx.assert(body.patient, 400, "Parameter error!",{details:{ patient: "undefined"}});
    ctx.assert(body.inspection, 400, "Parameter error!",{details:{ inspection: "undefined"}});
    ctx.assert(body.order, 400, "Parameter error!",{details:{ order: "undefined"}});

    //验证用户是否有权限
    let bAuth=false;
    let authorizes= {};
    let Hospid=0;
    let Account="";
    let res = await GetValidAccessToken(body.accessToken);//await userModel.findAccessToken(body.accessToken);
    if (res.length > 0) {
        Account=res[0].Account;
        let res1 = await userModel.findUser(res[0].Account);
        if (res1.length>0){
            Hospid=res1[0].Hospid
            let res2=await userModel.findRoleByID(res1[0].Role);
            if (res2.length>0){
                authorizes=res2[0].aut;
            }
        }else{

        }
     } else {
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }

    if (authorizes.length<=0){
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }else {
        for(let i = 0,l = authorizes.length;i<l ; i++){
            if (authorizes[i]==2){
                bAuth=true;
                break;
            }
        }
     }

    if (!bAuth){
        ctx.throw(401, "Parameter error!", {details:{status: "not authenticated"}});
    }



    // 验证 重复输入
    let pat=body.patient;
    let inspect=body.inspection;
    let order=body.order;

    let start=Date.now();
    let recordid = (new Date(start)).format('yyyyMMddhhmmssS');
    
    res=await userModel.query("select _id from patient where reqid=?",[inspect.reqid]);
    if (res.length > 0) {
        ctx.throw(400, "Parameter error!", {details:{status: "相同的申请单已经存在，请确认？"}});
    }

    res=await userModel.query("select _id from patient where recordid=?",[recordid]);

    if (res.length > 0) {
        ctx.throw(400, "Parameter error!", {details:{status: "相同的记录已经存在"}});
    } else {
        let sql="insert into patient set ";
        sql=sql+"recordid='"+recordid+"'";
        sql=sql+","+"patientid='"+pat.patientid+"'";
        if (pat.hasOwnProperty("name")) sql=sql+","+"name='"+pat.name +"'";
        if (pat.hasOwnProperty("sex")) sql=sql+","+"sex="+pat.sex;
        if (pat.hasOwnProperty("age")) sql=sql+","+"age='"+pat.age+"'";
        if (pat.hasOwnProperty("ageunit")) sql=sql+","+"ageunit="+pat.ageunit;
        if (pat.hasOwnProperty("idcard")) sql=sql+","+"idcard='"+pat.idcard+"'";
        if (pat.hasOwnProperty("birthdate")) sql=sql+","+"birthdate='"+pat.birthdate+"'";
        if (pat.hasOwnProperty("weight")) sql=sql+","+"weight='"+pat.weight+"'";
        if (pat.hasOwnProperty("height")) sql=sql+","+"height='"+pat.height+"'";
        if (pat.hasOwnProperty("address")) sql=sql+","+"address='"+pat.address+"'";
        if (pat.hasOwnProperty("phone")) sql=sql+","+"phone='"+pat.phone+"'";

        //inspect
        if (inspect.hasOwnProperty("visitid")) sql=sql+","+"visitid='"+inspect.visitid +"'";
        if (inspect.hasOwnProperty("pattype")) sql=sql+","+"pattype='"+inspect.pattype +"'";
        if (inspect.hasOwnProperty("outpatientid")) sql=sql+","+"outpatientid='"+inspect.outpatientid +"'";
        if (inspect.hasOwnProperty("inpatientid")) sql=sql+","+"inpatientid='"+inspect.inpatientid +"'";
        if (inspect.hasOwnProperty("bedid")) sql=sql+","+"bedid='"+inspect.bedid +"'";
        if (inspect.hasOwnProperty("clinic")) sql=sql+","+"clinic='"+inspect.clinic +"'";
        if (inspect.hasOwnProperty("medicine")) sql=sql+","+"medicine='"+inspect.medicine +"'";
        if (inspect.hasOwnProperty("reqid")) sql=sql+","+"reqid='"+inspect.reqid +"'";
        if (inspect.hasOwnProperty("senddept")) sql=sql+","+"senddept='"+inspect.senddept +"'";
        if (inspect.hasOwnProperty("senddoctor")) sql=sql+","+"senddoctor='"+inspect.senddoctor +"'";
        if (inspect.hasOwnProperty("senddate")) sql=sql+","+"senddate='"+inspect.senddate +"'";
        if (inspect.hasOwnProperty("note")) sql=sql+","+"note='"+inspect.note +"'";
        if (inspect.hasOwnProperty("hospname")) sql=sql+","+"hospname='"+inspect.hospname +"'";
        if (inspect.hasOwnProperty("hospaddr")) sql=sql+","+"hospaddr='"+inspect.hospaddr +"'";
        if (inspect.hasOwnProperty("hospphone")) sql=sql+","+"hospphone='"+inspect.hospphone +"'";

        sql=sql+","+"datstatus= 0";
        sql=sql+","+"anastatus= 0";
        sql=sql+","+"reviewstatus= 0";
        sql=sql+","+"datlocked= 0";
        sql=sql+","+"analocked= 0";

        sql=sql+","+"Hospid='"+Hospid +"'";

        console.log(sql);
        let res1 = await userModel.query(sql);
        console.log(res1);

        dbLogFile.debug(Account + " Add Patient, Name is "+ "\r\n  "+ pat.name+ "\r\n  "+ sql);



        // //////////////////更新HIS列表中的RECORDID 和 病人信息中保持一致////////////////////////////////////////
        // sql="update hispatinfo_hnqy set ";
        // sql=sql+"CBIS_RECORD_ID='"+recordid+"'";
        // sql =sql+" where 申请单号='"+inspect.reqid+"'";
        // await userModel.query(sql);        

        // dbLogFile.debug(Account + " update record to histable, Name is "+ "\r\n  "+ pat.name+ "\r\n  "+ sql);
        // ////////////////////////////////////////////////////////////////////////////////////////////////////


        //插入订单
        if (inspect.hasOwnProperty("reqid") && order.length>0){
            for(let i = 0,l = order.length;i<l ; i++){
                let tmpOrder=order[i];

                if (!tmpOrder.hasOwnProperty("itemtype")) continue;
                let res2=await userModel.findOrderList([inspect.reqid,tmpOrder.itemtype]);
                if (res2.length<=0){
                    sql="insert into orderlist set ";
                    sql=sql+"reqid='"+inspect.reqid+"'";
                    if (tmpOrder.hasOwnProperty("itemtype")) sql=sql+","+"itemtype='"+tmpOrder.itemtype +"'";
                    if (tmpOrder.hasOwnProperty("orderid")) sql=sql+","+"orderid='"+tmpOrder.orderid +"'";
                    if (tmpOrder.hasOwnProperty("orderitemtype")) sql=sql+","+"orderitemtype='"+tmpOrder.orderitemtype +"'";
                    if (tmpOrder.hasOwnProperty("orderitemname")) sql=sql+","+"orderitemname='"+tmpOrder.orderitemname +"'";
                    if (tmpOrder.hasOwnProperty("orderitemprice")) sql=sql+","+"orderitemprice='"+tmpOrder.orderitemprice +"'";
                    console.log(sql);
                    let res3 = await userModel.query(sql);
                    console.log(res3);
                }
            }
        }

        ctx.body = {
            status: "successful",
            recordid:recordid
        }
    }
});

//信息编辑
router.post('/EditPatient',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});
    ctx.assert(body.patient, 400, "Parameter error!",{details:{ patient: "undefined"}});
    ctx.assert(body.inspection, 400, "Parameter error!",{details:{ inspection: "undefined"}});
    ctx.assert(body.order, 400, "Parameter error!",{details:{ order: "undefined"}});

    //验证用户是否有权限
    let bAuth=false;
    let authorizes= {};
    let Account="";
    let res =await GetValidAccessToken(body.accessToken);// await userModel.findAccessToken(body.accessToken);
    if (res.length > 0) {
        Account=res[0].Account;
        let res1 = await userModel.findUser(res[0].Account);
        if (res1.length>0){
            let res2=await userModel.findRoleByID(res1[0].Role);
            if (res2.length>0){
                authorizes=res2[0].aut;
            }
        }else{

        }
    } else {
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }

    if (authorizes.length<=0){
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }else {
        for(let i = 0,l = authorizes.length;i<l ; i++){
            if (authorizes[i]==1){
                bAuth=true;
                break;
            }
        }
    }

    if (!bAuth){
        ctx.throw(401, "Parameter error!", {details:{status: "not authenticated"}});
    }




    // 验证 重复输入
    let pat=body.patient;
    let inspect=body.inspection;

    ctx.assert(inspect.recordid, 400, "Parameter error!",{details:{ recordid: "undefined"}});

    let recordid=inspect.recordid;
    res=await userModel.query("select _id from patient where recordid=?",[recordid]);
    if (res.length <= 0) {
        ctx.throw(400, "Data error!", {details:{status: "patient not exist"}});
    } else {
        let start=Date.now();
        let sql="update patient set ";
        sql=sql+"patientid='"+pat.patientid+"'";
        if (pat.hasOwnProperty("name")) sql=sql+","+"name='"+pat.name +"'";
        if (pat.hasOwnProperty("sex")) sql=sql+","+"sex="+pat.sex;
        if (pat.hasOwnProperty("age")) sql=sql+","+"age='"+pat.age+"'";
        if (pat.hasOwnProperty("ageunit")) sql=sql+","+"ageunit="+pat.ageunit;
        if (pat.hasOwnProperty("idcard")) sql=sql+","+"idcard='"+pat.idcard+"'";
        if (pat.hasOwnProperty("birthdate")) sql=sql+","+"birthdate='"+pat.birthdate+"'";
        if (pat.hasOwnProperty("weight")) sql=sql+","+"weight='"+pat.weight+"'";
        if (pat.hasOwnProperty("height")) sql=sql+","+"height='"+pat.height+"'";
        if (pat.hasOwnProperty("address")) sql=sql+","+"address='"+pat.address+"'";
        if (pat.hasOwnProperty("phone")) sql=sql+","+"phone='"+pat.phone+"'";

        //inspect
        if (inspect.hasOwnProperty("visitid")) sql=sql+","+"visitid='"+inspect.visitid +"'";
        if (inspect.hasOwnProperty("pattype")) sql=sql+","+"pattype='"+inspect.pattype +"'";
        if (inspect.hasOwnProperty("outpatientid")) sql=sql+","+"outpatientid='"+inspect.outpatientid +"'";
        if (inspect.hasOwnProperty("inpatientid")) sql=sql+","+"inpatientid='"+inspect.inpatientid +"'";
        if (inspect.hasOwnProperty("bedid")) sql=sql+","+"bedid='"+inspect.bedid +"'";
        if (inspect.hasOwnProperty("clinic")) sql=sql+","+"clinic='"+inspect.clinic +"'";
        if (inspect.hasOwnProperty("medicine")) sql=sql+","+"medicine='"+inspect.medicine +"'";
        if (inspect.hasOwnProperty("reqid")) sql=sql+","+"reqid='"+inspect.reqid +"'";
        if (inspect.hasOwnProperty("senddept")) sql=sql+","+"senddept='"+inspect.senddept +"'";
        if (inspect.hasOwnProperty("senddoctor")) sql=sql+","+"senddoctor='"+inspect.senddoctor +"'";
        if (inspect.hasOwnProperty("senddate")) sql=sql+","+"senddate='"+inspect.senddate +"'";
        if (inspect.hasOwnProperty("note")) sql=sql+","+"note='"+inspect.note +"'";
        if (inspect.hasOwnProperty("hospname")) sql=sql+","+"hospname='"+inspect.hospname +"'";
        if (inspect.hasOwnProperty("hospaddr")) sql=sql+","+"hospaddr='"+inspect.hospaddr +"'";
        if (inspect.hasOwnProperty("hospphone")) sql=sql+","+"hospphone='"+inspect.hospphone +"'";
        sql=sql+" where recordid="+recordid;
        //console .log(sql);
        let res1 = await userModel.query(sql);
        //console.log(res1);

        dbLogFile.debug(Account + " Edit Patient, Name is "+ "\r\n  "+ pat.name+ "\r\n  "+ sql);

        ctx.body = {
            status: "successful",
            recordid:recordid
        }
    }
});

//信息删除
router.post('/DeletePatient',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});
    ctx.assert(body.patient, 400, "Parameter error!",{details:{ patient: "undefined"}});
    ctx.assert(body.inspection, 400, "Parameter error!",{details:{ inspection: "undefined"}});
    ctx.assert(body.order, 400, "Parameter error!",{details:{ order: "undefined"}});

    //验证用户是否有权限
    let bAuth=false;
    let authorizes= {};
    let Account="";
    let res = await GetValidAccessToken(body.accessToken);//await userModel.findAccessToken(body.accessToken);
    if (res.length > 0) {
        Account=res[0].Account;
        let res1 = await userModel.findUser(res[0].Account);
        if (res1.length>0){
            let res2=await userModel.findRoleByID(res1[0].Role);
            if (res2.length>0){
                authorizes=res2[0].aut;
            }
        }else{

        }
    } else {
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }

    if (authorizes.length<=0){
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }else {
        for(let i = 0,l = authorizes.length;i<l ; i++){
            if (authorizes[i]==1){
                bAuth=true;
                break;
            }
        }
    }

    if (!bAuth){
        ctx.throw(401, "Parameter error!", {details:{status: "not authenticated"}});
    }




    // 验证 重复输入
    let pat=body.patient;
    let inspect=body.inspection;

    ctx.assert(inspect.recordid, 400, "Parameter error!",{details:{ recordid: "undefined"}});


    let recordid=inspect.recordid;
    res=await userModel.query("select * from patient where recordid=?",[recordid]);
    if (res.length <= 0) {
        ctx.throw(400, "Data error!", {details:{status: "patient not exist"}});
    } else {

        //删除数据库记录
        let reqid=res[0].reqid;
        let sql="delete from  patient where recordid= " +recordid +"";
        let res1 = await userModel.query(sql);

        dbLogFile.debug(Account + " Delete Patient, recordid is "+ "\r\n  "+ recordid+ "\r\n  "+ sql);

        sql="delete from  orderlist where reqid= '" +reqid +"'";
        //console .log(sql);
        let res2 = await userModel.query(sql);
        //console.log(res2);

        sql="delete from  report where reqid= '" +reqid +"'";
        //console .log(sql);
        let res3 = await userModel.query(sql);
        //console.log(res3);

        //删除对应的数据
        let filepath  ="";
        let isExist = false;

        filepath=UPLOAD_PATH+"/"+recordid+"_dat.zip";
        isExist = await exists(filepath);
        if (isExist) {
            fs.unlinkSync(filepath);
        }

        filepath=UPLOAD_PATH+"/"+recordid+"_ana.zip";
        isExist = await exists(filepath);
        if (isExist) {
            fs.unlinkSync(filepath);
        }

        filepath=UPLOAD_PATH+"/"+recordid+"_review.zip";
        isExist = await exists(filepath);
        if (isExist) {
            fs.unlinkSync(filepath);
        }

        filepath=UPLOAD_PATH+"/"+recordid+"_anareport.bg";
        isExist = await exists(filepath);
        if (isExist) {
            fs.unlinkSync(filepath);
        }

        filepath=UPLOAD_PATH+"/"+recordid+"_reviewreport.bg";
        isExist = await exists(filepath);
        if (isExist) {
            fs.unlinkSync(filepath);
        }



        ctx.body = {
            status: "successful",
            recordid:recordid
        }
    }
});

router.post('/ExistPatient',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});
    ctx.assert(body.patient, 400, "Parameter error!",{details:{ patient: "undefined"}});
    ctx.assert(body.inspection, 400, "Parameter error!",{details:{ inspection: "undefined"}});
    ctx.assert(body.order, 400, "Parameter error!",{details:{ order: "undefined"}});

    //验证用户是否有权限
    let bAuth=false;
    let authorizes= {};
    let res = await GetValidAccessToken(body.accessToken);//userModel.findAccessToken(body.accessToken);
    if (res.length > 0) {
        let res1 = await userModel.findUser(res[0].Account);
        if (res1.length>0){
            let res2=await userModel.findRoleByID(res1[0].Role);
            if (res2.length>0){
                authorizes=res2[0].aut;
            }
        }else{

        }
    } else {
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }

    if (authorizes.length<=0){
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }else {
        bAuth=true;
    }

    if (!bAuth){
        ctx.throw(401, "Parameter error!", {details:{status: "not authenticated"}});
    }

    // 验证 重复输入
    let pat=body.patient;
    let inspect=body.inspection;

    ctx.assert(pat.name, 400, "Parameter error!",{details:{ name: "undefined"}});
    //ctx.assert(inspect.reqid, 400, "Parameter error!",{details:{ reqid: "undefined"}});


    let pattype=inspect.pattype;
    let sql="";
    let value;
    if (inspect.reqid === undefined || inspect.reqid === '') {  //if (inspect.reqid!=""){
      if (pattype==0) {
          sql=`select _id,recordid,datstatus,anastatus,reviewstatus,datlocked,analocked from patient where name=? and pattype=? and inpatientid=?`;
          value=[pat.name,inspect.pattype,inspect.inpatientid];
      }else {
          sql=`select _id,recordid,datstatus,anastatus,reviewstatus,datlocked,analocked from patient where name=? and pattype=? and outpatientid=?`;
          value=[pat.name,inspect.pattype,inspect.outpatientid];
      }   
    
    }
    else{
      if (pattype==0) {
          sql=`select _id,recordid,datstatus,anastatus,reviewstatus,datlocked,analocked from patient where name=? and pattype=? and inpatientid=? and reqid=?`;
          value=[pat.name,inspect.pattype,inspect.inpatientid,inspect.reqid];
      }else {
          sql=`select _id,recordid,datstatus,anastatus,reviewstatus,datlocked,analocked from patient where name=? and pattype=? and outpatientid=? and reqid=?`;
          value=[pat.name,inspect.pattype,inspect.outpatientid,inspect.reqid];
      }
    }
    
    //console.log(typeof(inspect.reqid)+inspect.reqid);

    //console.log(sql+value);

    res=await userModel.query(sql,value);
    if (res.length <= 0) {
        ctx.body = {
            status: "failed",
            count:res.length
        }
    } else {

        let regCount=0;
        let arRegRecordid = [];
        let arRecordid=[];
        for (let i=0;i<res.length;i++){
            if (res[i].datstatus==0 && res[i].anastatus==0 && res[i].reviewstatus==0 && res[i].datlocked==0 && res[i].analocked==0){
                regCount++;
                arRegRecordid.push(res[i].recordid)
            }
            arRecordid.push(res[i].recordid)
        }

        ctx.body = {
            status: "successful",
            count: res.length,
            recordid: arRecordid,
            reg_count:regCount,
            reg_recordid:arRegRecordid
        }
    }
});

router.post('/PatientUpdateTime',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});

  //验证用户是否有权限
    let bAuth=false;
    let authorizes= {};
    let res = await GetValidAccessToken(body.accessToken);//userModel.findAccessToken(body.accessToken);
    if (res.length > 0) {
        let res1 = await userModel.findUser(res[0].Account);
        if (res1.length>0){
            let res2=await userModel.findRoleByID(res1[0].Role);
            if (res2.length>0){
                authorizes=res2[0].aut;
            }
        }else{

        }
    } else {
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }

    if (authorizes.length<=0){
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }else {
        bAuth=true;
    }

    if (!bAuth){
        ctx.throw(401, "Parameter error!", {details:{status: "not authenticated"}});
    }

    let patientupdatetime;
    let reportupdatetime;
    let sql="";
    sql="show table status";
    res=await userModel.query(sql);
    if (res.length >0) {
        for (let i=0;i<res.length;i++){
            if (res[i].Name=="patient"){
                patientupdatetime=res[i].Update_time;
            }else if (res[i].Name=="report"){
                reportupdatetime=res[i].Update_time;
            }
        }
    }

    if (patientupdatetime>reportupdatetime){
        ctx.body = {
            status: "successful",
            time:patientupdatetime
        }

    }else{
        ctx.body = {
            status: "successful",
            time:reportupdatetime
        }
    }
});


router.post('/List',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});
    ctx.assert(body.set, 400, "Parameter error!",{details:{ set: "undefined"}});
    ctx.assert(body.start, 400, "Parameter error!",{details:{ start: "undefined"}});
    ctx.assert(body.count, 400, "Parameter error!",{details:{ count: "undefined"}});

    //验证用户是否有权限
    let bAuth=false;
    let authorizes= {};
    let Hospids= new Array();
    let Institutionid=1;
    let HospidofUser="";
    let res = await GetValidAccessToken(body.accessToken);//await userModel.findAccessToken(body.accessToken);
    if (res.length > 0) {
        let res1 = await userModel.findUser(res[0].Account);
        if (res1.length>0){
            let res2=await userModel.findRoleByID(res1[0].Role);
            if (res2.length>0){
                authorizes=res2[0].aut;
            }

            let res3;
            let _sql = ""
            let _value;
            _sql = "select * from hospital where _id=?;"
            _value=[res1[0].Hospid];
            HospidofUser=_value;
            res3 = await userModel.query(_sql,_value);
            if (res3.length>0){
                Institutionid=res3[0].Institutionid;
                _sql = "select * from hospital where Institutionid=?;"
                _value=[res3[0].Institutionid];
                res3 = await userModel.query(_sql,_value);
                if (res3.length>0)
                {
                    for (let i=0;i<res3.length;i++){
                        Hospids[i]=res3[i]._id;
                    }
                }
            }
        }else{

        }
    } else {
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }

    if (authorizes.length<=0){
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }else {
        bAuth=true;
    }

    if (!bAuth){
        ctx.throw(401, "Parameter error!", {details:{status: "not authenticated"}});
    }

    let Account=res[0].Account;

    // 验证 重复输入
    let type;
    let sqlExtCodition="";
    let isSetJson=await isJson(body.set);
    if (isSetJson) {
        type=body.set.set;
        let conditions=body.set.search;
        if (conditions.length>0){
            for (let k=0;k<conditions.length;k++){
                let condition=conditions[k];
                if (condition.hasOwnProperty("Name") && condition.hasOwnProperty("Value")){
                    let name=condition["Name"];
                    let value=condition["Value"];
                    if (name=="senddate"){
                        value=value.toString();
                        if (value.indexOf("/")>0){
                            let array=value.split("/");
                            sqlExtCodition=sqlExtCodition+` and  ${name} between '${array[0]}' and '${array[1]}'`;
                        }else{
                            sqlExtCodition=sqlExtCodition+` and  ${name} = '${value}'`;
                        }

                    } else if (name=="age"){
                        value=value.toString();
                        if (value.indexOf("/")>0){
                            let array=value.split("/");
                            sqlExtCodition=sqlExtCodition+` and  ${name} between ${array[0]} and ${array[1]}`;
                        }else{
                            sqlExtCodition=sqlExtCodition+` and  ${name} = ${value}`;
                        }

                    } else if (name=="datuploader"){   //上传者需要搜索自己名字或还没上传的记录
                        //sqlExtCodition=sqlExtCodition+` and (${name} = '${value}' or ${name} is null)`;
                        sqlExtCodition=sqlExtCodition+` and (Hospid = '${HospidofUser}')`;    //采集用户所属医院
                    } else if (name=="datuploadersearch"){   //查询特定采集医生记录
                        name="datuploader";
                        sqlExtCodition=sqlExtCodition+` and ${name} = '${value}'`;
                    } else{
                        sqlExtCodition=sqlExtCodition+` and  ${name} = '${value}'`
                    }
                }

            }

            console.log(sqlExtCodition);
        }
    }else{
        type=body.set;
    }

    //增加用户所属医院的限制
    if (Hospids.length>1){
        for (let i=0;i<Hospids.length;i++){
            if (i==0){
                sqlExtCodition=sqlExtCodition+` and  (Hospid = '${Hospids[i]}'`
            }else{
                sqlExtCodition=sqlExtCodition+` or Hospid = '${Hospids[i]}'`
            }

            if (i==Hospids.length-1){
                sqlExtCodition=sqlExtCodition+`)`
            }

        }
    }else if (Hospids.length==1){   //当ID==1 时显示所有病例
        if (Hospids[0]!=1){
            sqlExtCodition=sqlExtCodition+` and  Hospid = '${Hospids[0]}'`
        }
    }

    let start=body.start;
    let count=body.count;

    let totalCount=0;
    let totalRegisteredCount=0;
    let totalNewCount=0;
    let totalAnalyzingCount=0;
    let totalAnalyzedCount=0;
    let totalReviewingCount=0;
    let totalReviewedCount=0;
    
    let resCount;
    if (sqlExtCodition!=""){
        resCount=await userModel.query("SELECT count(*) as count FROM patient where 1=1 "+sqlExtCodition);
    }else{
        resCount=await userModel.query("SELECT count(*) as count FROM patient");
    }

    if (resCount.length>0){
        totalCount=resCount[0].count;
    }

    resCount=await userModel.query("SELECT count(*) as count FROM patient where datstatus=0 and anastatus=0 and reviewstatus=0 and datlocked=0 and analocked=0"+sqlExtCodition );
    if (resCount.length>0){
        totalRegisteredCount=resCount[0].count;
    }

    resCount=await userModel.query("SELECT count(*) as count FROM patient where datstatus=1 and anastatus=0 and reviewstatus=0 and datlocked=0 and analocked=0"+sqlExtCodition);
    if (resCount.length>0){
        totalNewCount=resCount[0].count;
    }

    resCount=await userModel.query("SELECT count(*) as count FROM patient where datstatus=1 and anastatus=0 and reviewstatus=0 and datlocked=1 and analocked=0 "+sqlExtCodition);
    if (resCount.length>0){
        totalAnalyzingCount=resCount[0].count;
    }

    resCount=await userModel.query("SELECT count(*) as count FROM patient where datstatus=1 and anastatus=1 and reviewstatus=0 and datlocked=0 and analocked=0"+sqlExtCodition);
    if (resCount.length>0){
        totalAnalyzedCount=resCount[0].count;
    }

    resCount=await userModel.query("SELECT count(*) as count FROM patient where datstatus=1 and anastatus=1 and reviewstatus=0 and datlocked=0 and analocked=1"+sqlExtCodition);
    if (resCount.length>0){
        totalReviewingCount=resCount[0].count;
    }

    resCount=await userModel.query("SELECT count(*) as count FROM patient where datstatus=1 and anastatus=1 and reviewstatus=1 and datlocked=0 and analocked=0"+sqlExtCodition);
    if (resCount.length>0){
        totalReviewedCount=resCount[0].count;
    }
    
  
    if(totalCount<=0){
        //ctx.throw(401, "Parameter error!", {details:{status: "数据记录条数为0"}});
       let retRecords=[];
       let retCount = {
            new: 0,
            analyzing: 0,
            analyzed:0,
            reviewing: 0,
            reviewed: 0,
            registered:0,
            start: start,
            request: count,
            returned: 0,
            totalcount:totalCount,
            totalregisteredcount:totalRegisteredCount,
            totalnewcount:totalNewCount,
            totalanalyzingcount:totalAnalyzingCount,
            totalanalyzedcount:totalAnalyzedCount,
            totalreviewingcount:totalReviewingCount,
            totalreviewedcount:totalReviewedCount 
        }

            ctx.body={
                count:retCount,
                records:retRecords
            }

         return;
        
    }

    if (start>=totalCount){
        ctx.throw(401, "Parameter error!", {details:{status: "起始序号大于记录总条数"}});
    }else if (start+count>totalCount){
        //count=totalCount-start;
    }

    if (type=="all"){   //获取所有病人信息
        let sql;

        if (sqlExtCodition!=""){
            sql=`select * from patient where 1=1 `+sqlExtCodition+ ` ORDER BY recordid  desc  LIMIT ${start},${count};`
        }else{
            sql=`select * from patient ORDER BY recordid  desc  LIMIT ${start},${count};`
        }


        let res=await userModel.query(sql);

        let retRecords=[];
        let newCount=0;
        let AnalylzingCount=0;
        let AnalyzedCount=0;
        let reviewingCount=0;
        let reviewedCount=0;
        let registeredCount=0;
        let tmpStatus;
        let tmpLocked;
        let tmpLockedAccount="";
        for(let i = 0,l = res.length;i<l ; i++) {

            tmpStatus="";
            tmpLocked="false";
            if (res[i].datstatus == 1 && res[i].datlocked == 0 && res[i].anastatus == 0 && res[i].analocked == 0 && res[i].reviewstatus == 0) {
                newCount++;
                tmpStatus="new";
            } else if (res[i].datstatus == 1 && res[i].datlocked == 1 && res[i].anastatus == 0 && res[i].analocked == 0 && res[i].reviewstatus == 0) {
                AnalylzingCount++
                tmpStatus="analyzing";

                if (res[i].datdownloader==Account){
                    tmpLocked="self";
                } else{
                    tmpLocked="other";
                }

                tmpLockedAccount=res[i].datdownloader;

            } else if (res[i].datstatus == 1 && res[i].datlocked == 1 && res[i].anastatus == 0 && res[i].analocked == 0 && res[i].reviewstatus == 1) {   //审核之后允许重新上传分析数据（北大深圳医院专用，通用版可删除该分支）
                AnalylzingCount++
                tmpStatus="analyzing";

                if (res[i].datdownloader==Account){
                    tmpLocked="self";
                } else{
                    tmpLocked="other";
                }
                tmpLockedAccount=res[i].datdownloader;


            } else if (/*res[i].datstatus == 1 && */res[i].datlocked == 0 && res[i].anastatus == 1 && res[i].analocked == 0 && res[i].reviewstatus == 0) {
                AnalyzedCount++
                tmpStatus="analyzed";
            } else if (res[i].datstatus == 1 && res[i].datlocked == 0 && res[i].anastatus == 1 && res[i].analocked == 1 && res[i].reviewstatus == 0) {
                reviewingCount++
                tmpStatus="reviewing";

                if (res[i].anadownloader==Account){
                    tmpLocked="self";
                } else{
                    tmpLocked="other";
                }

                tmpLockedAccount=res[i].anadownloader;

            } else if (/*res[i].datstatus == 1 && */res[i].datlocked == 0 && res[i].anastatus == 1 && res[i].analocked == 0 && res[i].reviewstatus == 1) {
                reviewedCount++;
                tmpStatus="reviewed";

            } else{
                registeredCount++;
                tmpStatus="registered";
            }


            let resOrder=await userModel.query("select * from orderlist where reqid=?",[res[i].reqid]);
            let itemtype="";
            for (let j=0;j<resOrder.length;j++){
                if (j==0){
                    itemtype=itemtype+resOrder[j].itemtype;
                } else{
                    itemtype=itemtype+"/"+resOrder[j].itemtype;
                }
            }

            let resReport=await userModel.query("select * from report where reqid=?",[res[i].reqid]);
            let starttime="";
            let duration="";
            if (resReport.length>0) {
                starttime=resReport[0].starttime;
                duration=resReport[0].duration;
            }

            let tmpRecord = {
                locked: tmpLocked,
                lockedaccount:tmpLockedAccount,
                status: tmpStatus,
                caseid:res[i].patientid,
                patient: res[i].name,
                sex:res[i].sex,
                age:res[i].age,
                inpatientid: res[i].inpatientid,
                outpatientid: res[i].outpatientid,
                senddoctor: res[i].senddoctor,
                senddept: res[i].senddept,
                registerdate: res[i].senddate,
                recordid: res[i].recordid,
                recordtype:itemtype,
                recordtime:starttime,
                duration:duration,
                opdoctor:res[i].datuploader,
                anadoctor:res[i].anauploader,
                reviewdoctor:res[i].reviewuploader,
                reviewdate:res[i].reviewuploaddate,
                hospname:res[i].hospname,
                anadate:res[i].anauploaddate,
            }
            retRecords.push(tmpRecord);



         }
        let retCount = {
            new: newCount,
            analyzing: AnalylzingCount,
            analyzed:AnalyzedCount,
            reviewing: reviewingCount,
            reviewed: reviewedCount,
            registered:registeredCount,
            start: start,
            request: count,
            returned: res.length,
            totalcount:totalCount,
            totalregisteredcount:totalRegisteredCount,
            totalnewcount:totalNewCount,
            totalanalyzingcount:totalAnalyzingCount,
            totalanalyzedcount:totalAnalyzedCount,
            totalreviewingcount:totalReviewingCount,
            totalreviewedcount:totalReviewedCount 
        }

        if (res.length>0){
            ctx.body={
                count:retCount,
                records:retRecords
            }
        } 
    } else {

        let sql;
        if (type=="registered"){
            sql=`select * from patient where datstatus=0 and anastatus=0 and reviewstatus=0 and datlocked=0 and analocked=0 `+sqlExtCodition+` ORDER BY recordid  desc LIMIT ${start},${count};`
         } else if (type=="new"){
            sql=`select * from patient where datstatus=1 and anastatus=0 and reviewstatus=0 and datlocked=0 and analocked=0 `+sqlExtCodition+`  ORDER BY recordid  desc LIMIT ${start},${count};`
        } else if (type=="analyzing"){
            sql=`select * from patient where datstatus=1 and anastatus=0 and reviewstatus=0 and datlocked=1 and analocked=0 `+sqlExtCodition+`  ORDER BY recordid  desc LIMIT ${start},${count};`
        } else if (type=="analyzed"){
            sql=`select * from patient where datstatus=1 and anastatus=1 and reviewstatus=0 and datlocked=0 and analocked=0 `+sqlExtCodition+`  ORDER BY recordid  desc LIMIT ${start},${count};`
        } else if (type=="reviewing"){
            sql=`select * from patient where datstatus=1 and anastatus=1 and reviewstatus=0 and datlocked=0 and analocked=1 `+sqlExtCodition+`  ORDER BY recordid  desc LIMIT ${start},${count};`
        } else if (type=="reviewed"){
            sql=`select * from patient where datstatus=1 and anastatus=1 and reviewstatus=1 and datlocked=0 and analocked=0 `+sqlExtCodition+`  ORDER BY recordid  desc LIMIT ${start},${count};`
        }

        let res=await userModel.query(sql);
        let retRecords=[];
        let newCount=0;
        let AnalylzingCount=0;
        let AnalyzedCount=0;
        let reviewingCount=0;
        let reviewedCount=0;
        let registeredCount=0;
        let tmpStatus;
        let tmpLocked;
        for(let i = 0,l = res.length;i<l ; i++) {
            tmpStatus="";
            tmpLocked="false";

            if (res[i].datstatus == 1 && res[i].datlocked == 0 && res[i].anastatus == 0 && res[i].analocked == 0 && res[i].reviewstatus == 0) {
                newCount++;
                tmpStatus="new";
            } else if (res[i].datstatus == 1 && res[i].datlocked == 1 && res[i].anastatus == 0 && res[i].analocked == 0 && res[i].reviewstatus == 0) {
                AnalylzingCount++
                tmpStatus="analyzing";

                if (res[i].datdownloader==Account){
                    tmpLocked="self";
                } else{
                    tmpLocked="other";
                }

            } else if (/*res[i].datstatus == 1 && */res[i].datlocked == 0 && res[i].anastatus == 1 && res[i].analocked == 0 && res[i].reviewstatus == 0) {
                AnalyzedCount++
                tmpStatus="analyzed";
            } else if (res[i].datstatus == 1 && res[i].datlocked == 0 && res[i].anastatus == 1 && res[i].analocked == 1 && res[i].reviewstatus == 0) {
                reviewingCount++
                tmpStatus="reviewing";

                if (res[i].anadownloader==Account){
                    tmpLocked="self";
                } else{
                    tmpLocked="other";
                }
            } else if (/*res[i].datstatus == 1 && */res[i].datlocked == 0 && res[i].anastatus == 1 && res[i].analocked == 0 && res[i].reviewstatus == 1) {
                reviewedCount++;
                tmpStatus="reviewed";

            } else{
                registeredCount++;
                tmpStatus="registered";
            }

            let resOrder=await userModel.query("select * from orderlist where reqid=?",[res[i].reqid]);
            let itemtype="";
            for (let j=0;j<resOrder.length;j++){
                if (j==0){
                    itemtype=itemtype+resOrder[j].itemtype;
                } else{
                    itemtype=itemtype+"/"+resOrder[j].itemtype;
                }
            }

            let resReport=await userModel.query("select * from report where reqid=?",[res[i].reqid]);
            let starttime="";
            let duration="";
            if (resReport.length>0) {
                starttime=resReport[0].starttime;
                duration=resReport[0].duration;
            }

            let tmpRecord = {
                locked: tmpLocked,
                status: tmpStatus,
                caseid:res[i].patientid,
                patient: res[i].name,
                sex:res[i].sex,
                age:res[i].age,
                inpatientid: res[i].inpatientid,
                outpatientid: res[i].outpatientid,
                senddoctor: res[i].senddept,
                senddept: res[i].senddoctor,
                registerdate: res[i].senddate,
                recordid: res[i].recordid,
                recordtype:itemtype,
                recordtime:starttime,
                duration:duration,
                opdoctor:res[i].datuploader,
                anadoctor:res[i].anauploader,
                reviewdoctor:res[i].reviewuploader,
                reviewdate:res[i].reviewuploaddate,
                hospname:res[i].hospname,
                anadate:res[i].anauploaddate,
            }
            retRecords.push(tmpRecord);


        }
        let retCount = {
            new: newCount,
            analyzing: AnalylzingCount,
            analyzed:AnalyzedCount,
            reviewing: reviewingCount,
            reviewed: reviewedCount,
            registered:registeredCount,
            start: start,
            request: count,
            returned: res.length,
            totalcount:totalCount,
            totalregisteredcount:totalRegisteredCount,
            totalnewcount:totalNewCount,
            totalanalyzingcount:totalAnalyzingCount,
            totalanalyzedcount:totalAnalyzedCount,
            totalreviewingcount:totalReviewingCount,
            totalreviewedcount:totalReviewedCount 
        }

            ctx.body={
                count:retCount,
                records:retRecords
            }

    }


});


router.post('/SetStatus',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});
    ctx.assert(body.recordid, 400, "Parameter error!",{details:{recordid : "undefined"}});
    ctx.assert(body.set, 400, "Parameter error!",{details:{ set: "undefined"}});
    ctx.assert(body.status, 400, "Parameter error!",{details:{ status: "undefined"}});

    let type=body.set;
    //验证用户是否有权限
    let bAuth=false;
    let authorizes= {};
    let res = await GetValidAccessToken(body.accessToken);//await userModel.findAccessToken(body.accessToken);
    if (res.length > 0) {
        let res1 = await userModel.findUser(res[0].Account);
        if (res1.length>0){
            let res2=await userModel.findRoleByID(res1[0].Role);
            if (res2.length>0){
                authorizes=res2[0].aut;
            }
        }else{

        }
    } else {
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }

    if (authorizes.length<=0){
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }else {
        for(let i = 0,l = authorizes.length;i<l ; i++){
            if (authorizes[i]==3 && type=="uploaddat"){   //上传数据
                bAuth=true;
                break;
            } else if (authorizes[i]==4 && type=="downloaddat"){  //下载数据

                bAuth=true;
                break;
            } else if (authorizes[i]==5 && type=="uploadana"){  //上传分析数据
                bAuth=true;
                break;
            } else if (authorizes[i]==6 && type=="downloadana"){  //下载分析数据
                bAuth=true;
                break;
            } else if (authorizes[i]==7 && type=="uploadreview"){  //上传审核数据
                bAuth=true;
                break;
            } else if (authorizes[i]==8 && type=="downloadreview"){  //下载审核数据
                bAuth=true;
                break;
            }
        }
    }
    if (!bAuth){
        ctx.throw(401, "data error!", {details:{status: "not authenticated"}});
    }
    let account=res[0].Account

    let res1=await userModel.query("select _id from patient where recordid=?",[body.recordid]);
    if (res1.length<=0){
        ctx.throw(401, "data error!", {details:{status: "record not exist"}});
    }

    let time=Date.now();
    let _sql="";
    let value="";
    let datatype=type;
    let statvalue=body.status;
    let recordid=body.recordid;
    if (datatype=="uploaddat"){   //上传数据
        _sql="update Patient set datstatus=?,datuploader=?,datuploaddate=? where recordid=?";
        value=[statvalue,account,new Date(time),recordid];
    } else if (datatype=="downloaddat"){  //下载数据
        if (statvalue==0){   //取消正在分析状态
            _sql="update Patient set datlocked=?,datdownloader=?,datdownloaddate=?,reviewstatus=0 where recordid=?";
            value=[statvalue,account,new Date(time),recordid];
        }else{
            _sql="update Patient set datlocked=?,datdownloader=?,datdownloaddate=?,anastatus=0,reviewstatus=0 where recordid=?";
            value=[statvalue,account,new Date(time),recordid];
        }

   } else if (datatype=="uploadana"){  //上传分析数据
        _sql="update Patient set anastatus=?,anauploader=?,anauploaddate=?,datlocked=0 where recordid=?";
        value=[statvalue,account,new Date(time),recordid];
    } else if (datatype=="downloadana"){  //下载分析数据
        if (statvalue==0){  //取消正在审核状态
            _sql="update Patient set analocked=?,anadownloader=?,anadownloaddate=? where recordid=?";
            value=[statvalue,account,new Date(time),recordid];
        }else{
            _sql="update Patient set analocked=?,anadownloader=?,anadownloaddate=?,reviewstatus=0 where recordid=?";
            value=[statvalue,account,new Date(time),recordid];
        }
    } else if (datatype=="uploadreview"){  //上传审核结果
        _sql="update Patient set reviewstatus=?,reviewuploader=?,reviewuploaddate=?,analocked=0,datlocked=0 where recordid=?";
        value=[statvalue,account,new Date(time),recordid];
    } else if (datatype=="uploadreport"){  //上传报告
        //_sql="update Patient set reviewstatus=?,reviewuploader=?,reviewuploaddate=?,analocked=0 where recordid=?";
        //value=[statvalue,account,new Date(time),recordid];
    }

    if (_sql!="" &&　value!="") {
        let res2=await userModel.query(_sql,value);

        dbLogFile.debug(account + " UpdateStatus, sql is "+ "\r\n  "+ _sql + value);
        ctx.body= {
            status:"successful"
        }
    }
    else {
        ctx.throw(401, "data error!", {details:{status: "not support"}});
    }
});

//上传数据
router.post('/UploadDat',async function (ctx, next) {
    let body = ctx.request.body;

    let apipara=JSON.parse(ctx.req.headers.apipara);   //注意 head 是不区分大小写的，转换过来全部是小写
    // 验证参数
    ctx.assert(apipara.accesstoken, 400, "Parameter error!",{details:{ accesstoken: "undefined"}});
    ctx.assert(apipara.recordid, 400, "Parameter error!",{details:{recordid : "undefined"}});
    ctx.assert(apipara.set, 400, "Parameter error!",{details:{ set: "undefined"}});
   // ctx.assert(apipara.size, 400, "Parameter error!",{details:{ size: "undefined"}});
    ctx.assert(apipara.md5, 400, "Parameter error!",{details:{ md5: "undefined"}});
    //ctx.assert(apipara.cancel, 400, "Parameter error!",{details:{ cancel: "undefined"}});


    let type=apipara.set;
    //验证用户是否有权限
    let bAuth=false;
    let authorizes= {};
    let res = await GetValidAccessToken(apipara.accesstoken);//await userModel.findAccessToken(apipara.accesstoken);
    if (res.length > 0) {
        let res1 = await userModel.findUser(res[0].Account);
        if (res1.length>0){
            let res2=await userModel.findRoleByID(res1[0].Role);
            if (res2.length>0){
                authorizes=res2[0].aut;
            }
        }else{

        }
    } else {
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }

    if (authorizes.length<=0){
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }else {
        for(let i = 0,l = authorizes.length;i<l ; i++){
            if (authorizes[i]==3 && type=="dat"){   //上传心电数据
                bAuth=true;
                break;
            } else if (authorizes[i]==5 && type=="ana"){
                bAuth=true;
                break;
            } else if (authorizes[i]==7 && type=="review"){
                bAuth=true;
                break;
            }else if (authorizes[i]==9 && (type=="anareport"||type=="reviewreport")){
                bAuth=true;
                break;
            }
    }
    }
    if (!bAuth){
        ctx.throw(401, "data error!", {details:{status: "not authenticated"}});
    }

    if(!fs.existsSync(UPLOAD_PATH)){
        fs.mkdirSync(UPLOAD_PATH);
    }

    let Account=res[0].Account

    let filepath  ="";
    let filenewpath="";
    if (type=="dat"){
        filepath  =UPLOAD_PATH+"/"+apipara.recordid+"_dat.zip.tmp";
        filenewpath=UPLOAD_PATH+"/"+apipara.recordid+"_dat.zip";
    } else if (type=="ana"){
        filepath  =UPLOAD_PATH+"/"+apipara.recordid+"_ana.zip.tmp";
        filenewpath=UPLOAD_PATH+"/"+apipara.recordid+"_ana.zip";
    } else if (type=="review"){
        filepath  =UPLOAD_PATH+"/"+apipara.recordid+"_review.zip.tmp";
        filenewpath=UPLOAD_PATH+"/"+apipara.recordid+"_review.zip";
    }else if (type=="anareport"){
        filepath  =UPLOAD_PATH+"/"+apipara.recordid+"_anareport.bg.tmp";
        filenewpath=UPLOAD_PATH+"/"+apipara.recordid+"_anareport.bg";
    }else if (type=="reviewreport"){
        filepath  =UPLOAD_PATH+"/"+apipara.recordid+"_reviewreport.bg.tmp";
        filenewpath=UPLOAD_PATH+"/"+apipara.recordid+"_reviewreport.bg";
    }

    let temp=apipara.offset;


    if(!apipara.hasOwnProperty('offset')){
        if (apipara.cancel=="false"){ //查询上次上传文件碎片

            let isExist = await exists(filepath);
            if (isExist){
                let {
                    md5,
                    filesize
                } = await retriveFileInfo(filepath);

                if (md5!=apipara.md5 || filesize!=apipara.size){
                    ctx.throw(400, "Data error!", {details:{status: "upload in progress"}});
                }
            } else{
                ctx.body= {
                    status:"没有碎片需要删除"
                }
            }

        } else if (apipara.cancel=="true"){   //撤销上次的上传,删除临时文件
            let isExist = await exists(filepath);
            if (isExist) {
                fs.unlinkSync(filepath);
                ctx.body= {
                    status:"删除碎片成功"
                }            }
            else{
                ctx.body= {
                    status:"没有碎片文件"
                }
            }
        }
    }else {  //开始上传数据
        let offset = Number(apipara.offset);
        let isExist = await exists(filepath);
        if(isExist){
            let stats = fs.statSync(filepath);
            if (stats.size!=offset) {
                ctx.throw(401, "Data error!", {details: {status: "offset is error"}});
            }
        }

        try {
            let {
                files
            } = await multipartyUpload(ctx.req, true);
            let file=files.file[0];
            let buffer = fs.readFileSync(file.path);
            if (buffer.length>0){
                let fd = fs.openSync(filepath, 'a+',);
                let ret = fs.writeSync(fd, buffer, 0, buffer.length, offset);
                fs.closeSync(fd);

                fs.unlinkSync(file.path);

                if (offset + buffer.length>=Number(apipara.size)){  //最后一段文件，需要将文件重新命名，去掉.TMP后缀
                    fs.renameSync(filepath,filenewpath);
                    ctx.status = 200;
                    ctx.body= {
                        bytes_received:String(ret),
                        uploadid:type,
                        finished:String(true)
                    }

                    //设置病例状态
                    let datatype=""
                    if (type=="dat"){   //上传心电数据
                        datatype="uploaddat";
                    } else if (type=="ana"){
                        datatype="uploadana";
                    } else if (type=="review"){
                        datatype = "uploadreview";
                    } else if (type == "anareport" || type == "reviewreport") {
                        datatype = "uploadreport";
                    }
                    if (datatype!="") {
                        SetCaseStatus(Account,apipara.recordid,datatype,1);



                        //需要将BG报告转换成pDF报告
                        if (type=="anareport" || type=="reviewreport"){
                            let filepdfpath=filenewpath;
                            filepdfpath=filepdfpath.replace(".bg",".pdf");
                            const isPdf = isPDFFile(filenewpath);
                            if (isPdf){
                                fs.renameSync(filenewpath,filepdfpath);
                            }
                            else
                            {

                                bioxcvt.bgtopdf(DLL_PATH,filenewpath,filepdfpath, 50);
                                //console.log(filenewpath+"   "+filepdfpath);
                            }

                            //将pdf路径写入数据库
                            let res1=await userModel.query("select * from patient where recordid=?",[apipara.recordid]);
                            if (res1.length>0){
                                let res2=await userModel.query("select * from orderlist where reqid=? ",[res1[0].reqid]);
                                if (res2.length>0){
                                
                                    const rootUrl = `${ctx.protocol}://${ctx.host}`;
                                    const pdfUrl=`${rootUrl}/reports/webPage?sqdid=${res2[0].reqid}`
                                    const pdfDownoadUrl=`${rootUrl}/pdf/Download?filePath=${filepdfpath}`
                                    let time=(new Date()).format('yyyy-MM-dd hh:mm:ss')
                                    let sql="update report set ";
                                    sql=sql+"bioxreport='"+filepdfpath+"'";
                                    sql=sql+",reporturl='"+pdfUrl+"'";
                                    sql=sql+",imagesreport='"+pdfDownoadUrl+"'";
                                    sql=sql+",lastupdate= '"+time+"'";
                                    sql =sql+" where reqid='"+res2[0].reqid+"' and itemtype='" + res2[0].itemtype+"'";
                                    await userModel.query(sql);
                                    //console.log(sql);

                                    // ////////////////////////////更新申请单原始数据库，用于报告上传,不同的客户表格名称不一样////////////////////
                                    // sql="select * from hispatinfo_hnqy where CBIS_RECORD_ID='"+apipara.recordid+"'";
                                    // let resTemp=await userModel.query(sql);
                                    // let sqlOtherCondition=""
                                    // if (resTemp.length>1){  //有多条就记录
                                    //   sqlOtherCondition=sqlOtherCondition+" and 检查项目名称='"+resTemp[0].检查项目名称+"'"
                                    // }
                                    // console.log(sqlOtherCondition);

                                    // sql="update hispatinfo_hnqy set ";
                                    // sql=sql+"LOCAL_REPORT_STATUS='1',HIS_REPORT_STATUS='0',HIS_REPORT_URL='"+pdfUrl+"'";
                                    // sql =sql+" where CBIS_RECORD_ID='"+apipara.recordid+"'";
                                    // if (sqlOtherCondition!="") sql=sql+sqlOtherCondition;
                                    // await userModel.query(sql);
                                   
                                    // dbLogFile.debug(Account + " Update hispatient_hnqy LOCAL_REPORT_STATUS , recordid is "+ "\r\n  "+ apipara.recordid+ "\r\n  "+ sql);
                                    // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////


                                }
                            }
                        }

                    }
                } else{
                   ctx.status = 202;
                   ctx.body= {
                        bytes_received:String(ret),
                        uploadid:type,
                        finished:String(false)
                    }

                }
            }
        }catch (err) {
            ctx.throw(401, "Data error!", {details: {status: err}});
        }
    }

});

//下载数据
router.post('/DownloadDat',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.accesstoken, 400, "Parameter error!",{details:{ accesstoken: "undefined"}});
    ctx.assert(body.set, 400, "Parameter error!",{details:{set : "undefined"}});
    ctx.assert(body.recordid, 400, "Parameter error!",{details:{recordid : "undefined"}});
    ctx.assert(body.start, 400, "Parameter error!",{details:{ start: "undefined"}});
    ctx.assert(body.end, 400, "Parameter error!",{details:{ end: "undefined"}});

    let type=body.set;

    //验证用户是否有权限
    let bAuth=false;
    let authorizes= {};
    let res =await GetValidAccessToken(body.accesstoken);// await userModel.findAccessToken(body.accesstoken);
    if (res.length > 0) {
        let res1 = await userModel.findUser(res[0].Account);
        if (res1.length>0){
            let res2=await userModel.findRoleByID(res1[0].Role);
            if (res2.length>0){
                authorizes=res2[0].aut;
            }
        }else{

        }
    } else {
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }

    if (authorizes.length<=0){
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }else {
        for(let i = 0,l = authorizes.length;i<l ; i++){
            if (authorizes[i]==4 && type=="dat"){   //下载心电数据
                bAuth=true;
                break;
            } else if (authorizes[i]==6 && type=="ana"){
                bAuth=true;
                break;
            } else if (authorizes[i]==8 && type=="review"){
                bAuth=true;
                break;
            }else if (authorizes[i]==9 && (type=="anareport"||type=="reviewreport")){
                bAuth=true;
                break;
            }else if (type=="excel"){
                bAuth=true;
                break;
            }
        }
    }
    if (!bAuth){
        ctx.throw(401, "data error!", {details:{status: "not authenticated"}});
    }
    let Account=res[0].Account


    let filepath  = "";

    if (type=="dat"){
        filepath  =UPLOAD_PATH+"/"+body.recordid+"_dat.zip";
    } else if (type=="ana"){
        filepath  =UPLOAD_PATH+"/"+body.recordid+"_ana.zip";
    } else if (type=="review"){
        filepath  =UPLOAD_PATH+"/"+body.recordid+"_review.zip";
    }else if (type=="anareport"){
        filepath  =UPLOAD_PATH+"/"+body.recordid+"_anareport.bg";
    }else if (type=="reviewreport"){
        filepath  =UPLOAD_PATH+"/"+body.recordid+"_reviewreport.bg";
    }else if (type=="excel"){
        filepath  =UPLOAD_PATH+"/export.csv";
    }

    if (filepath==""){
        ctx.throw(401, "data error!", {details:{status: "type error"}});
    }

    let start=Number(body.start);
    let end=Number(body.end);

    let isExist = await exists(filepath);
    if (!isExist){
        ctx.throw(401, "data error!", {details:{status: "文件不存在"}});
    }

    let stats = fs.statSync(filepath);

    if (start==0 && end==0){ //返回总文件长度
        ctx.body= {
            status:"successful",
            filesize:String(stats.size)
        }
        return;
    }else if (body.end=="all"){
        end=stats.size-1;
    }
    if (start<0) start=0;
    if (start>=stats.size)start=stats.size-1;
    if (end>=stats.size)end=stats.size-1;
    let len=end-start+1;


    let buffer=Buffer.alloc(len);
    let fd = fs.openSync(filepath, 'a+',);
    let ret = fs.readSync(fd, buffer, 0, len, start);
    fs.closeSync(fd);

    ctx.res.writeHead(200,{'Content-Type':'application/octet-stream'});
    ctx.res.write(buffer);
    ctx.res.end();

    // //传输结束需更新数据库状态
    // if (end>=stats.size-1) {
    //     //设置病例状态
    //     let datatype=""
    //     if (type=="dat"){   //上传心电数据
    //         datatype="downloaddat";
    //     } else if (type=="ana"){
    //         datatype="downloadana";
    //     } else if (type=="review"){
    //         datatype="downloadreview";
    //     }else if (type=="anareport" || type=="reviewreport" ){
    //         datatype="downloadreport";
    //     }
    //     if (datatype!="") {
    //         SetCaseStatus(Account,body.recordid,datatype,1);
    //     }
    // }

    //let stream = fs.createReadStream(filepath,  { start: start, end: end });
    //stream.pipe(ctx.res);
    // let resContentType = "application/octet-stream";
    //
    // // 二进制流
    // stream.on('data', (chunk) => {
    //     //ctx.res.write(chunk);
    //     let resHead = {
    //         code: 200,
    //         head: {
    //             'Content-Length': chunk.length,
    //             'Content-type': resContentType,
    //         }
    //     };
    //
    //     //ctx.res.writeHead(200,{'Content-Type':'text/plain;charset=UTF8'});
    //     //ctx.res.writeHead(resHead.code,resHead.head);
    //     //ctx.res.write(chunk);
    //     ctx.res.statusCode=200;
    //     ctx.set('Content-Type',resContentType);
    //
    //     //ctx.body=chunk;
    //
    //     ctx.body={
    //         status:"3333"
    //     };
    //
    //     console.log(`接收到 ${chunk.length} 个字节的数据`);
    // });
    // stream.on('end', () => {
    //     console.log('结束');
    // });
    //
    // ctx.body={
    //     status:"successful"
    // };
    //
    // console.log("2222");

});

//获取报告详细信息
router.post('/PatDetail',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});
    ctx.assert(body.recordid, 400, "Parameter error!",{details:{recordid : "undefined"}});

    //验证用户是否有权限
    let bAuth=false;
    let authorizes= {};
    let res = await GetValidAccessToken(body.accessToken);//await userModel.findAccessToken(body.accessToken);
    if (res.length > 0) {
        let res1 = await userModel.findUser(res[0].Account);
        if (res1.length>0){
            let res2=await userModel.findRoleByID(res1[0].Role);
            if (res2.length>0){
                authorizes=res2[0].aut;
            }
        }else{

        }
    } else {
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }

    if (authorizes.length<=0){
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }else {
        bAuth=true;
    }

    if (!bAuth){
        ctx.throw(401, "data error!", {details:{status: "not authenticated"}});
    }
    let Account=res[0].Account


    let patient={};
    let order=[];
    let report=[];
    let res1=await userModel.query("select * from patient where recordid=?",[body.recordid]);
    if (res1.length<=0){
        ctx.throw(401, "data error!", {details:{status: "pat record not exist"}});
    }
    patient=res1[0];

    let res2=await userModel.query("select * from orderlist where reqid=? ",[patient.reqid]);
    if (res2.length<=0){
        //ctx.throw(401, "data error!", {details:{status: "order record not exist"}});
    }
    else{
       for (let i=0,l=res2.length;i<l;i++){
          order.push(res2[i]);
          let res3=await userModel.query("select * from report where reqid=? and itemtype=?",[res2[i].reqid,res2[i].itemtype]);
          if (res3.length>0){
              report.push(res3[0]);
          }
      }

    }
    

    ctx.body={
        patient:patient,
        order:order,
        report:report
    };

});

//报告文字信息
router.post('/UpdateReport',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});
    ctx.assert(body.report, 400, "Parameter error!",{details:{ patient: "undefined"}});

    //验证用户是否有权限
    let bAuth=false;
    let authorizes= {};
    let Account="";
    let res = await GetValidAccessToken(body.accessToken);//await userModel.findAccessToken(body.accessToken);
    if (res.length > 0) {
        Account=res[0].Account;
        let res1 = await userModel.findUser(res[0].Account);
        if (res1.length>0){
            let res2=await userModel.findRoleByID(res1[0].Role);
            if (res2.length>0){
                authorizes=res2[0].aut;
            }
        }else{

        }
    } else {
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }

    if (authorizes.length<=0){
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }else {
        for(let i = 0,l = authorizes.length;i<l ; i++){
            if (authorizes[i]==5 || authorizes[i]==7){
                bAuth=true;
                break;
            }
        }
    }

    if (!bAuth){
        ctx.throw(401, "Parameter error!", {details:{status: "not authenticated"}});
    }


    // 验证 重复输入
    let report=body.report[0];
    ctx.assert(report.recordid, 400, "Parameter error!",{details:{ recordid: "undefined"}});
    ctx.assert(report.recordtype, 400, "Parameter error!",{details:{ recordtype: "undefined"}});
    let recordid=report.recordid;
    let res1=await userModel.query("select * from patient where recordid=?",[recordid]);

    if (res1.length <= 0) {
        ctx.throw(401, "data error!", {details:{status: "patient not exist"}});
    } else {
        let reqid=res1[0].reqid;
        let itemtype=Number(report.recordtype);
        let start=Date.now();
        let sql="";

        let res2=await userModel.query("select * from report where reqid=? and itemtype=?",[reqid,itemtype]);
        if (res2.length<=0) {
            sql="insert into report set ";
            sql=sql+"reqid='"+reqid+"'";
            sql=sql+","+"itemtype="+itemtype;
            if (report.hasOwnProperty("boxid")) sql=sql+","+"boxid='"+report.boxid +"'";
            if (report.hasOwnProperty("recordtype")) sql=sql+","+"recordtype="+report.recordtype;
            if (report.hasOwnProperty("starttime")) sql=sql+","+"starttime='"+report.starttime+"'";
            if (report.hasOwnProperty("duration")) sql=sql+","+"duration='"+report.duration+"'";
            if (report.hasOwnProperty("opeDoctor")) sql=sql+","+"opeDoctor='"+report.opeDoctor+"'";
            if (report.hasOwnProperty("opeDate")) sql=sql+","+"opeDate='"+report.opeDate+"'";
            if (report.hasOwnProperty("diagDoctor")) sql=sql+","+"diagDoctor='"+report.diagDoctor+"'";
            if (report.hasOwnProperty("diagDate")) sql=sql+","+"diagDate='"+report.diagDate+"'";
            if (report.hasOwnProperty("reviewDoctor")) sql=sql+","+"reviewDoctor='"+report.reviewDoctor+"'";
            if (report.hasOwnProperty("reviewDate")) sql=sql+","+"reviewDate='"+report.reviewDate+"'";
            if (report.hasOwnProperty("conclusion")) sql=sql+","+"conclusion='"+report.conclusion+"'";
            if (report.hasOwnProperty("abpconclusion")) sql=sql+","+"abpconclusion='"+report.abpconclusion+"'";
            if (report.hasOwnProperty("ecgconclusion")) sql=sql+","+"ecgconclusion='"+report.ecgconclusion+"'";
            if (report.hasOwnProperty("imagesreport")) sql=sql+","+"imagesreport='"+report.imagesreport+"'";
            if (report.hasOwnProperty("bioxreport")) sql=sql+","+"bioxreport='"+report.bioxreport+"'";
            if (report.hasOwnProperty("isVLP")) sql=sql+","+"isVLP='"+report.isVLP+"'";
            if (report.hasOwnProperty("isPM")) sql=sql+","+"isPM='"+report.isPM+"'";
            if (report.hasOwnProperty("bHasPVC")) sql=sql+","+"bHasPVC='"+report.bHasPVC+"'";
            if (report.hasOwnProperty("bHasPCU")) sql=sql+","+"bHasPCU='"+report.bHasPCU+"'";
            if (report.hasOwnProperty("bHasPause")) sql=sql+","+"bHasPause='"+report.bHasPause+"'";

        }else{
            sql="update report set ";
            sql=sql+"reqid='"+reqid+"'";
            if (report.hasOwnProperty("boxid")) sql=sql+","+"boxid='"+report.boxid +"'";
            if (report.hasOwnProperty("recordtype")) sql=sql+","+"recordtype="+report.recordtype;
            if (report.hasOwnProperty("starttime")) sql=sql+","+"starttime='"+report.starttime+"'";
            if (report.hasOwnProperty("duration")) sql=sql+","+"duration='"+report.duration+"'";
            if (report.hasOwnProperty("opeDoctor")) sql=sql+","+"opeDoctor='"+report.opeDoctor+"'";
            if (report.hasOwnProperty("opeDate")) sql=sql+","+"opeDate='"+report.opeDate+"'";
            if (report.hasOwnProperty("diagDoctor")) sql=sql+","+"diagDoctor='"+report.diagDoctor+"'";
            if (report.hasOwnProperty("diagDate")) sql=sql+","+"diagDate='"+report.diagDate+"'";
            if (report.hasOwnProperty("reviewDoctor")) sql=sql+","+"reviewDoctor='"+report.reviewDoctor+"'";
            if (report.hasOwnProperty("reviewDate")) sql=sql+","+"reviewDate='"+report.reviewDate+"'";
            if (report.hasOwnProperty("conclusion")) sql=sql+","+"conclusion='"+report.conclusion+"'";
            if (report.hasOwnProperty("abpconclusion")) sql=sql+","+"abpconclusion='"+report.abpconclusion+"'";
            if (report.hasOwnProperty("ecgconclusion")) sql=sql+","+"ecgconclusion='"+report.ecgconclusion+"'";
            if (report.hasOwnProperty("imagesreport")) sql=sql+","+"imagesreport='"+report.imagesreport+"'";
            if (report.hasOwnProperty("bioxreport")) sql=sql+","+"bioxreport='"+report.bioxreport+"'";
            if (report.hasOwnProperty("isVLP")) sql=sql+","+"isVLP='"+report.isVLP+"'";
            if (report.hasOwnProperty("isPM")) sql=sql+","+"isPM='"+report.isPM+"'";
            if (report.hasOwnProperty("bHasPVC")) sql=sql+","+"bHasPVC='"+report.bHasPVC+"'";
            if (report.hasOwnProperty("bHasPCU")) sql=sql+","+"bHasPCU='"+report.bHasPCU+"'";
            if (report.hasOwnProperty("bHasPause")) sql=sql+","+"bHasPause='"+report.bHasPause+"'";

            sql =sql+" where reqid='"+reqid+"' and itemtype='" + itemtype+"'";

        }


        //console.log(sql);
        let res3 = await userModel.query(sql);
        //console.log(res3);

        dbLogFile.debug(Account + " Update Report, reqid is "+ "\r\n  "+ reqid+ "\r\n  "+ sql);

        ctx.body = {
            status: "update successful",
            recordid:recordid
        }
    }
});

router.post('/AccountList',async function (ctx, next) {
    let res=await userModel.query("SELECT  Account FROM user");
    if (res.length>0){
        ctx.body={
            rows:res
        }
    }else{
        ctx.throw(401, "Parameter error!", {details:{status: "User Account is 0"}});
    }
});


//将搜索到的记录保存到excel文件
router.post('/SaveAsExcel',async function (ctx, next) {
    let body = ctx.request.body;
    // 验证参数
    ctx.assert(body.accessToken, 400, "Parameter error!",{details:{ accessToken: "undefined"}});
    ctx.assert(body.set, 400, "Parameter error!",{details:{ set: "undefined"}});

    //验证用户是否有权限
    let bAuth=false;
    let authorizes= {};
    let res = await GetValidAccessToken(body.accessToken);//await userModel.findAccessToken(body.accessToken);
    if (res.length > 0) {
        let res1 = await userModel.findUser(res[0].Account);
        if (res1.length>0){
            let res2=await userModel.findRoleByID(res1[0].Role);
            if (res2.length>0){
                authorizes=res2[0].aut;
            }
        }else{

        }
    } else {
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }

    if (authorizes.length<=0){
        ctx.throw(400, "Parameter error!", {details:{status: "missing data"}});
    }else {
        bAuth=true;
    }

    if (!bAuth){
        ctx.throw(401, "Parameter error!", {details:{status: "not authenticated"}});
    }

    let Account=res[0].Account;

    // 验证 重复输入
    let type;
    let sqlExtCodition="";
    let isSetJson=await isJson(body.set);
    if (isSetJson) {
        type=body.set.set;
        let conditions=body.set.search;
        if (conditions.length>0){
            for (let k=0;k<conditions.length;k++){
                let condition=conditions[k];
                if (condition.hasOwnProperty("Name") && condition.hasOwnProperty("Value")){
                    let name=condition["Name"];
                    let value=condition["Value"];
                    if (name=="senddate"){
                        value=value.toString();
                        if (value.indexOf("/")>0){
                            let array=value.split("/");
                            sqlExtCodition=sqlExtCodition+` and  ${name} between '${array[0]}' and '${array[1]}'`;
                        }else{
                            sqlExtCodition=sqlExtCodition+` and  ${name} = '${value}'`;
                        }

                    } else if (name=="age"){
                        value=value.toString();
                        if (value.indexOf("/")>0){
                            let array=value.split("/");
                            sqlExtCodition=sqlExtCodition+` and  ${name} between ${array[0]} and ${array[1]}`;
                        }else{
                            sqlExtCodition=sqlExtCodition+` and  ${name} = ${value}`;
                        }

                    } else{
                        sqlExtCodition=sqlExtCodition+` and  ${name} = '${value}'`
                    }
                }

            }

            console.log(sqlExtCodition);
        }
    }else{
        type=body.set;
    }

    if (type=="all"){   //获取所有病人信息
        let sql;

        if (sqlExtCodition!=""){
            sql=`select * from patient where 1=1 `+sqlExtCodition+ ` ORDER BY recordid  desc;`
        }else{
            sql=`select * from patient ORDER BY recordid  desc;`
        }

        let res=await userModel.query(sql);

        dbLogFile.debug(Account + " Save Excel, sql is "+ "\r\n  "+ sql);

        let retRecords=[];
        let newCount=0;
        let AnalylzingCount=0;
        let AnalyzedCount=0;
        let reviewingCount=0;
        let reviewedCount=0;
        let registeredCount=0;
        let tmpStatus;
        let tmpLocked;
        for(let i = 0,l = res.length;i<l ; i++) {

            tmpStatus="";
            tmpLocked="false";
            if (res[i].datstatus == 1 && res[i].datlocked == 0 && res[i].anastatus == 0 && res[i].analocked == 0 && res[i].reviewstatus == 0) {
                newCount++;
                tmpStatus="new";
            } else if (res[i].datstatus == 1 && res[i].datlocked == 1 && res[i].anastatus == 0 && res[i].analocked == 0 && res[i].reviewstatus == 0) {
                AnalylzingCount++
                tmpStatus="analyzing";

                if (res[i].datdownloader==Account){
                    tmpLocked="self";
                } else{
                    tmpLocked="other";
                }

            } else if (res[i].datstatus == 1 && res[i].datlocked == 1 && res[i].anastatus == 0 && res[i].analocked == 0 && res[i].reviewstatus == 1) {   //审核之后允许重新上传分析数据（北大深圳医院专用，通用版可删除该分支）
                AnalylzingCount++
                tmpStatus="analyzing";

                if (res[i].datdownloader==Account){
                    tmpLocked="self";
                } else{
                    tmpLocked="other";
                }

            } else if (/*res[i].datstatus == 1 && */res[i].datlocked == 0 && res[i].anastatus == 1 && res[i].analocked == 0 && res[i].reviewstatus == 0) {
                AnalyzedCount++
                tmpStatus="analyzed";
            } else if (res[i].datstatus == 1 && res[i].datlocked == 0 && res[i].anastatus == 1 && res[i].analocked == 1 && res[i].reviewstatus == 0) {
                reviewingCount++
                tmpStatus="reviewing";

                if (res[i].anadownloader==Account){
                    tmpLocked="self";
                } else{
                    tmpLocked="other";
                }
            } else if (/*res[i].datstatus == 1 && */res[i].datlocked == 0 && res[i].anastatus == 1 && res[i].analocked == 0 && res[i].reviewstatus == 1) {
                reviewedCount++;
                tmpStatus="reviewed";

            } else{
                registeredCount++;
                tmpStatus="registered";
            }


            let resOrder=await userModel.query("select * from orderlist where reqid=?",[res[i].reqid]);
            let itemtype="";
            for (let j=0;j<resOrder.length;j++){
                if (j==0){
                    itemtype=itemtype+resOrder[j].itemtype;
                } else{
                    itemtype=itemtype+" "+resOrder[j].itemtype;
                }
            }

            let resReport=await userModel.query("select * from report where reqid=?",[res[i].reqid]);
            let starttime="";
            let duration="";
            if (resReport.length>0) {
                starttime=resReport[0].starttime;
                duration=resReport[0].duration;
            }

            let tmpRecord = {
                locked: tmpLocked,
                status: tmpStatus,
                caseid:res[i].patientid,
                patient: res[i].name,
                sex:res[i].sex,
                inpatientid: res[i].inpatientid,
                outpatientid: res[i].outpatientid,
                senddoctor: res[i].senddoctor,
                senddept: res[i].senddept,
                registerdate: res[i].senddate,
                recordid: `'${res[i].recordid}'`,
                recordtype:itemtype,
                recordtime:starttime,
                duration:duration,
                opdoctor:res[i].datuploader,
                anadoctor:res[i].anauploader,
                reviewdoctor:res[i].reviewuploader,
                reviewdate:res[i].reviewuploaddate,
                hospname:res[i].hospname,
                anadate:res[i].anauploaddate,
            }
            retRecords.push(tmpRecord);
        }

        if (res.length>0){
            let jData, fields
            if(Object.prototype.toString.call(retRecords) === '[object Object]') {
                jData = Object.keys(retRecords).map(key => ({
                    key: key,
                    value: retRecords[key]
                }))
                fields = ['key', 'value']
            }
            if(Object.prototype.toString.call(retRecords) === '[object Array]') {
                jData = retRecords
                fields = Object.keys(retRecords[0])
            }

            // json格式 => csv格式
            const json2csvParser = new Json2csvParser({fields})
            //const csvData = json2csvParser.parse(jData)
            const csvData = iconv.encode(json2csvParser.parse(jData), 'GBK')

            // office Excel需要 BOM 头来定义 UTF-8编码格式
            const BOM = Buffer.from("\ufeff")
            const bomCsv = Buffer.concat([BOM, Buffer.from(csvData)])




            // 写入的文件名
            const outputFileName = `${UPLOAD_PATH}/export.csv`

            // 不存在文件夹就创建
            if(!fs.existsSync(UPLOAD_PATH)) {
                fs.mkdirSync(UPLOAD_PATH)
            }

            if(fs.existsSync(outputFileName)) {
                fs.unlinkSync(outputFileName);
            }
            // 写入文件
            const err = fs.writeFileSync(outputFileName, bomCsv)
            if(err) {
                ctx.throw(401, "parameters error!", {details:{status: "create csv file failed"}});
            } else {
                ctx.body={};
            }

        }else {
            ctx.throw(401, "parameters error!", {details:{status: "not find record"}});
        }
    } else {

        let sql;
        if (type=="registered"){
            sql=`select * from patient where datstatus=0 and anastatus=0 and reviewstatus=0 and datlocked=0 and analocked=0 `+sqlExtCodition+` ORDER BY recordid  desc;`
        } else if (type=="new"){
            sql=`select * from patient where datstatus=1 and anastatus=0 and reviewstatus=0 and datlocked=0 and analocked=0 `+sqlExtCodition+`  ORDER BY recordid  desc;`
        } else if (type=="analyzing"){
            sql=`select * from patient where datstatus=1 and anastatus=0 and reviewstatus=0 and datlocked=1 and analocked=0 `+sqlExtCodition+`  ORDER BY recordid  desc;`
        } else if (type=="analyzed"){
            sql=`select * from patient where datstatus=1 and anastatus=1 and reviewstatus=0 and datlocked=0 and analocked=0 `+sqlExtCodition+`  ORDER BY recordid  desc;`
        } else if (type=="reviewing"){
            sql=`select * from patient where datstatus=1 and anastatus=1 and reviewstatus=0 and datlocked=0 and analocked=1 `+sqlExtCodition+`  ORDER BY recordid  desc;`
        } else if (type=="reviewed"){
            sql=`select * from patient where datstatus=1 and anastatus=1 and reviewstatus=1 and datlocked=0 and analocked=0 `+sqlExtCodition+`  ORDER BY recordid  desc;`
        }

        let res=await userModel.query(sql);

        dbLogFile.debug(Account + " Save Excel, sql is "+ "\r\n  "+ sql);


        let retRecords=[];
        let newCount=0;
        let AnalylzingCount=0;
        let AnalyzedCount=0;
        let reviewingCount=0;
        let reviewedCount=0;
        let registeredCount=0;
        let tmpStatus;
        let tmpLocked;
        for(let i = 0,l = res.length;i<l ; i++) {
            tmpStatus="";
            tmpLocked="false";

            if (res[i].datstatus == 1 && res[i].datlocked == 0 && res[i].anastatus == 0 && res[i].analocked == 0 && res[i].reviewstatus == 0) {
                newCount++;
                tmpStatus="new";
            } else if (res[i].datstatus == 1 && res[i].datlocked == 1 && res[i].anastatus == 0 && res[i].analocked == 0 && res[i].reviewstatus == 0) {
                AnalylzingCount++
                tmpStatus="analyzing";

                if (res[i].datdownloader==Account){
                    tmpLocked="self";
                } else{
                    tmpLocked="other";
                }

            } else if (/*res[i].datstatus == 1 && */res[i].datlocked == 0 && res[i].anastatus == 1 && res[i].analocked == 0 && res[i].reviewstatus == 0) {
                AnalyzedCount++
                tmpStatus="analyzed";
            } else if (res[i].datstatus == 1 && res[i].datlocked == 0 && res[i].anastatus == 1 && res[i].analocked == 1 && res[i].reviewstatus == 0) {
                reviewingCount++
                tmpStatus="reviewing";

                if (res[i].anadownloader==Account){
                    tmpLocked="self";
                } else{
                    tmpLocked="other";
                }
            } else if (/*res[i].datstatus == 1 && */res[i].datlocked == 0 && res[i].anastatus == 1 && res[i].analocked == 0 && res[i].reviewstatus == 1) {
                reviewedCount++;
                tmpStatus="reviewed";

            } else{
                registeredCount++;
                tmpStatus="registered";
            }

            let resOrder=await userModel.query("select * from orderlist where reqid=?",[res[i].reqid]);
            let itemtype="";
            for (let j=0;j<resOrder.length;j++){
                if (j==0){
                    itemtype=itemtype+resOrder[j].itemtype;
                } else{
                    itemtype=itemtype+" "+resOrder[j].itemtype;
                }
            }

            let resReport=await userModel.query("select * from report where reqid=?",[res[i].reqid]);
            let starttime="";
            let duration="";
            if (resReport.length>0) {
                starttime=resReport[0].starttime;
                duration=resReport[0].duration;
            }

            let tmpRecord = {
                locked: tmpLocked,
                status: tmpStatus,
                caseid:res[i].patientid,
                patient: res[i].name,
                sex:res[i].sex,
                inpatientid: res[i].inpatientid,
                outpatientid: res[i].outpatientid,
                senddoctor: res[i].senddept,
                senddept: res[i].senddoctor,
                registerdate: res[i].senddate,
                recordid: `'${res[i].recordid}'`,  //res[i].recordid,
                recordtype:itemtype,
                recordtime:starttime,
                duration:duration,
                opdoctor:res[i].datuploader,
                anadoctor:res[i].anauploader,
                reviewdoctor:res[i].reviewuploader,
                reviewdate:res[i].reviewuploaddate,
                hospname:res[i].hospname,
                anadate:res[i].anauploaddate,
            }
            retRecords.push(tmpRecord);


        }
        if (res.length>0){
            let jData, fields
            if(Object.prototype.toString.call(retRecords) === '[object Object]') {
                jData = Object.keys(retRecords).map(key => ({
                    key: key,
                    value: retRecords[key]
                }))
                fields = ['key', 'value']
            }
            if(Object.prototype.toString.call(retRecords) === '[object Array]') {
                jData = retRecords
                fields = Object.keys(retRecords[0])
            }

            // json格式 => csv格式
            const json2csvParser = new Json2csvParser({fields})
            //const csvData = json2csvParser.parse(jData)
            const csvData = iconv.encode(json2csvParser.parse(jData), 'GBK')

            // office Excel需要 BOM 头来定义 UTF-8编码格式
            const BOM = Buffer.from('\xEF\xBB\xBF')
            const bomCsv = Buffer.concat([BOM, Buffer.from(csvData)])

            // 写入的文件名
            const outputFileName = `${UPLOAD_PATH}/export.csv`

            // 不存在文件夹就创建
            if(!fs.existsSync(UPLOAD_PATH)) {
                fs.mkdirSync(UPLOAD_PATH)
            }

            if(fs.existsSync(outputFileName)) {
                fs.unlinkSync(outputFileName);
            }
            // 写入文件
            const err = fs.writeFileSync(outputFileName, bomCsv)
            if(err) {
                ctx.throw(401, "parameters error!", {details:{status: "create csv file failed"}});
            } else {
                ctx.body={};
            }

        }else {
            ctx.throw(401, "parameters error!", {details:{status: "not find record"}});
        }

    }

});


module.exports = router;