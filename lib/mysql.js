var mysql = require('mysql');
const md5 = require("../middlewares/md5");

var pool  = mysql.createPool({
    host     : "192.168.0.20",
    user     : "root",
    password : "123456",
    database : "cbis"
});


let users =
    `create table if not exists User(
     _id INT NOT NULL AUTO_INCREMENT,
     Account VARCHAR(255) NOT NULL,
     Password VARCHAR(255) NOT NULL,
     Name VARCHAR(255) ,
     Dept VARCHAR(255) ,
     Role INT ,
     Date DATETIME,
     Hospid INT,
     LoginDate DATETIME,
     LoginFailCount INT,
     LastLoginDate DATETIME,
     PRIMARY KEY ( _id )
    );`

let roles =
    `create table if not exists Role(
     _id INT NOT NULL AUTO_INCREMENT,
     name VARCHAR(255) NOT NULL,
     aut VARCHAR(255) NOT NULL,
     date DATETIME,
     PRIMARY KEY ( _id )
    );`

let accesstokens =
    `create table if not exists accessToken(
     _id INT NOT NULL AUTO_INCREMENT,
     Account VARCHAR(255) NOT NULL,
     accessToken VARCHAR(100) NOT NULL,
     refreshToken VARCHAR(100) NOT NULL,
     accessTime VARCHAR(100) NOT NULL,
     refreshTime VARCHAR(100) NOT NULL,
     PRIMARY KEY ( _id )
    );`

let auths =
    `create table if not exists auth(
     _id INT NOT NULL AUTO_INCREMENT,
     Name VARCHAR(255) NOT NULL,
     Date DATETIME,
     PRIMARY KEY ( _id )
    );`

let agents =
    `CREATE TABLE IF NOT EXISTS Agent(
    _id int(11) NOT NULL AUTO_INCREMENT,
    AgentName varchar(40) NOT NULL,
    Contact varchar(30) ,
    MobilePhone varchar(30),
    Addr varchar(200),
    PRIMARY KEY (_id)
    );`


let institutions =
    `CREATE TABLE IF NOT EXISTS institution(
    _id int(11) NOT NULL AUTO_INCREMENT,
    name varchar(40) NOT NULL,
    addr varchar(30) ,
    phone varchar(30),
    corpid varchar(30),
    des varchar(200),
    PRIMARY KEY (_id)
    );`

let hospitals =
    `CREATE TABLE IF NOT EXISTS Hospital(
     _id int(11) NOT NULL AUTO_INCREMENT,
    hospName varchar(40) NOT NULL,
    Area varchar(30) ,
    Contact varchar(30),
    MobilePhone varchar(30),
    Phone varchar(30),
    Addr varchar(200),
    Institutionid int(11),
    Agentid int(11),
    PRIMARY KEY (_id)
    )`


let patients =
    `create table if not exists patient(
     _id INT NOT NULL AUTO_INCREMENT,
     recordid VARCHAR(255) NOT NULL,
     patientid VARCHAR(255) NOT NULL,
     name VARCHAR(255) NOT NULL,
     sex VARCHAR(1),
     age VARCHAR(3),
     ageunit VARCHAR(1),
     birthdate DATETIME,
     address  VARCHAR(255),
     phone  VARCHAR(255),
     idcard  VARCHAR(255),
     weight  VARCHAR(255),
     height  VARCHAR(255),
     visitid  VARCHAR(255),
     pattype  VARCHAR(1),
     outpatientid  VARCHAR(255),
     inpatientid  VARCHAR(255),
     bedid  VARCHAR(255),
     clinic  VARCHAR(255),
     medicine  VARCHAR(255),
     note  VARCHAR(255),
     reqid  VARCHAR(255),
     senddept  VARCHAR(255),
     senddoctor  VARCHAR(255),
     senddate DATETIME,
     hospname  VARCHAR(255),
     hospaddr  VARCHAR(255),
     hospphone VARCHAR(255),
     datstatus int,
     datuploader VARCHAR(255),
     datuploaddate DATETIME,
     datpath VARCHAR(255),
     anastatus int,
     anauploader VARCHAR(255),
     anauploaddate DATETIME,
     anapath VARCHAR(255),
     reviewstatus int,
     reviewuploader VARCHAR(255),
     reviewuploaddate DATETIME,
     reviewpath VARCHAR(255),
     datlocked int,
     datdownloader VARCHAR(255),
     datdownloaddate DATETIME,
     analocked int,
     anadownloader VARCHAR(255),
     anadownloaddate DATETIME,
     Hospid int,
     PRIMARY KEY ( _id )
    );`

let orders =
    `create table if not exists orderlist(
     _id INT NOT NULL AUTO_INCREMENT,
     reqid VARCHAR(255) NOT NULL,
     itemtype int,
     orderid VARCHAR(255),
     orderitemtype VARCHAR(255),
     orderitemname VARCHAR(255),
     orderitemprice VARCHAR(255),
     PRIMARY KEY ( _id )
    );`

let reports =
    `create table if not exists report(
     _id INT NOT NULL AUTO_INCREMENT,
     reqid VARCHAR(255) NOT NULL,
     itemtype int,
     boxid VARCHAR(255),
     recordtype int,
     starttime DATETIME,
     duration VARCHAR(255),
     opeDoctor VARCHAR(255),
     opeDate DATETIME,
     diagDoctor VARCHAR(255),
     diagDate DATETIME,
     reviewDoctor VARCHAR(255),
     reviewDate DATETIME,
     isVlp int,
     isPm int,
     bHasPVC int,
     bHasPCU int,
     bHasPause int,
     conclusion VARCHAR(1024),
     abpconclusion VARCHAR(1024),
     ecgconclusion VARCHAR(1024),
     imagesreport VARCHAR(1024),
     bioxreport VARCHAR(255),
     reporturl VARCHAR(255),
     jpgurl VARCHAR(255),
     lastupdate DATETIME,
     PRIMARY KEY ( _id )
    );`

let query = function( sql, values ) {
    return new Promise(( resolve, reject ) => {
        pool.getConnection(function(err, connection) {
            if (err) {
                reject( err )
            } else {
                connection.query(sql, values, ( err, rows) => {

                    if ( err ) {
                        reject( err )
                    } else {
                        resolve( rows )
                    }
                    connection.release()
                })
            }
        })
    })
}


let createTable = function( sql ) {
    return query( sql, [] )
}

//建表
createTable(users);
createTable(accesstokens);
createTable(roles);
createTable(auths);
createTable(agents);
createTable(institutions);
createTable(hospitals);
createTable(patients);
createTable(orders);
createTable(reports);


//初始化表格
const initTable=function InitTable(tableName){

    return new Promise(async ( resolve, reject ) => {

        let _sql=`select * from ${tableName}`;
        let res=await query(_sql);
        let value;
        let Name=["用户管理","登记病例","采集数据上传","采集数据下载","分析数据上传","分析数据下载","审核数据上传","审核数据下载","报告查看","编辑病例","删除病例"];
        let now=new Date();
        if (res.length<=0){
            if (tableName=='auth'){
                for (let i=0;i<11;i++){
                    sql="insert into auth set Name=?,Date=?";
                    value=[Name[i],now];
                    await query(sql,value);
                }
            }else if (tableName=='role'){
                let tmpAut;
                sql="insert into role set name=?,aut=?,date=?";
                tmpAut='[1,2,3,4,5,6,7,8,9,10,11]';
                value=['管理员',tmpAut,now];
                await query(sql,value);

                sql="insert into role set name=?,aut=?,date=?";
                tmpAut='[2,3,8,9]';
                value=['数据采集员',tmpAut,now];
                await query(sql,value);

                sql="insert into role set name=?,aut=?,date=?";
                tmpAut='[4,5,6,8,9]';
                value=['分析医生',tmpAut,now];
                await query(sql,value);

                sql="insert into role set name=?,aut=?,date=?";
                tmpAut='[4,5,6,7,8,9]';
                value=['审核医生',tmpAut,now];
                await query(sql,value);

                sql="insert into role set name=?,aut=?,date=?";
                tmpAut='[6,8,9]';
                value=['普通医生',tmpAut,now];
                await query(sql,value);

            }else if (tableName=='user'){
                sql="insert into user set Account=?,Password=?,Role=?,Hospid=?";
                let pass = md5.hex_md5("biox@123456");
                value=['admin',pass,1,1];
                await query(sql,value);
            }else if (tableName=='institution'){
                sql="insert into Institution set name=?";
                value=['all'];
                await query(sql,value);
            }else if (tableName=='hospital'){
                sql="insert into Hospital set hospName=?,Institutionid=?";
                value=['biox',1];
                await query(sql,value);
            }
        }
    })
}

initTable('auth');
initTable('role');
initTable('user');
initTable('institution');
initTable('hospital');

let getRecordCount = function( tableName ) {
    let _sql =  `SELECT COUNT(*) as count FROM ${tableName};`
    let res= query( _sql);
    let count=0;
    if (res.length>0){
        count=res[0].count;
    }
    return count;
}

// 注册用户
let insertUser = function( value ) {
    let _sql = "insert into user set Account=?,Password=?,Name=?,Dept=?,Role=?;"
    return query( _sql, value )
}
// 删除用户
let deleteUser = function( Account ) {
    let _sql = `delete from user where Account="${Account}";`
    return query( _sql )
}
let deleteUserByID = function( id ) {
    let _sql = `delete from user where _id="${id}";`
    return query( _sql )
}

let updateUserPassword = function( value ) {
    let _sql = "update user set Password=? where Account=?"
    return query( _sql,value)
}

let updateUserName = function( value ) {
    let _sql = "update user set Name=? where Account=?"
    return query( _sql,value)
}

let updateUserRole = function( value ) {
    let _sql = "update user set Role=? where Account=?"
    return query( _sql,value)
}


// 查找用户
let findUser = function( Account ) {
    let _sql = `select * from user where Account="${Account}";`
    return query( _sql )
}

// 查找所有用户
let AllUser = function() {
    let _sql = `select _id,Account,Name,Role,Hospid from user;`
    return query( _sql )
}

let Login=function(value){
    let _sql = `select * from user where Account=? and Password=?;`
    return query( _sql,value )
}


// 增加accessToken
let insertAccessToken = function( value ) {
    let _sql = "insert into accessToken set Account=?,accessToken=?,refreshToken=?,accessTime=?,refreshTime=?;"
    return query( _sql, value )
}
// 删除
let deleteAccessToken = function( Account ) {
    let _sql = `delete from accessToken where Account="${Account}";`
    return query( _sql)
}
// 查找
let findAccessToken = function( accessToken ) {
    let _sql = `select * from accessToken where accessToken="${accessToken}";`
    return query( _sql)
}

// 增加Role
let insertRole= function( value ) {
    let _sql = "insert into Role set name=?,aut=?;"
    return query( _sql, value )
}
// 删除
let deleteRole = function( value ) {
    let _sql = `delete from Role where name=?;`
    return query( _sql ,value)
}

let deleteRoleByID = function( id ) {
    let _sql = `delete from Role where _id="${id}";`
    return query( _sql)
}

// 查找
let findRole = function( name ) {
    let _sql = `select * from Role where name="${name}";`
    return query( _sql)
}

let findRoleByID = function( id ) {
    let _sql = `select * from Role where _id = ${id};`
    return query( _sql)
}


// 查找所有角色
let AllRole = function() {
    let _sql = `select * from Role;`
    return query( _sql )
}

let updateRoleName = function( value ) {
    let _sql = "update Role set name=? where _id=?"
    return query( _sql,value)
}

let updateRoleAuth = function( value ) {
    let _sql = "update Role set aut=? where _id=?"
    return query( _sql,value)
}

// 查找所有用户
let AllAuth = function() {
    let _sql = `select * from auth;`
    return query( _sql )
}


// 增加病人信息
let insertPatient= function( value ) {
    let _sql = "insert into patient set name=?,aut=?;"
    return query( _sql, value )
}

// 删除
let deletePatient = function( value ) {
    let _sql = `delete from patient where name=?;`
    return query( _sql ,value)
}

let findPatientByPatientID = function( patientid ) {
    let _sql = `select * from patient where patientid = ${patientid};`
    return query( _sql)
}

let findOrderList= function( value ) {
    let _sql = `select * from orderlist where reqid=? and itemtype=?;`
    return query( _sql, value )
}

module.exports = {
    createTable,
    query,
    getRecordCount,
    insertUser,
    deleteUser,
    deleteUserByID,
    updateUserPassword,
    updateUserName,
    updateUserRole,
    findUser,
    AllUser,
    Login,
    insertAccessToken,
    deleteAccessToken,
    findAccessToken,
    insertRole,
    deleteRole,
    findRole,
    findRoleByID,
    AllRole,
    updateRoleName,
    updateRoleAuth,
    deleteRoleByID,
    AllAuth,
    insertPatient,
    deletePatient,
    findPatientByPatientID,
    findOrderList,
}

