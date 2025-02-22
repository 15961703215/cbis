const path = require('path');
const log4js = require('log4js');

log4js.configure({
    appenders: {
        //access: {
            //type: 'dateFile',
            //pattern: '-yyyy-MM-dd.log', //生成文件的规则
            //alwaysIncludePattern: true, //文件名始终以日期区分
            //filename: path.join('./logs/', 'access.log') //生成文件名
        //},
        access: {
            type: 'file',
            filename: './logs/access.log',
            keepFileExt: true,
            maxLogSize: 10485760,
            backups: 20
        },
        error: {
            type: 'file',
            filename: './logs/error.log',
            keepFileExt: true,
            maxLogSize: 10485760,
            backups: 20
        },
        application: {
            type: 'dateFile',
            pattern: 'yyyy-MM-dd.log',
            alwaysIncludePattern: true, //文件名始终以日期区分
            filename: path.join('./logs/', 'application')
        },
        out: {
            type: 'console'
        }
    },
    categories: {
        default: { appenders: [ 'out' ], level: 'info' },
        access: { appenders: [ 'access' ], level: 'debug' },
        error: { appenders: [ 'error' ], level: 'debug' },
        application: { appenders: [ 'application' ], level: 'debug'}
    }
});

var accessLogger = log4js.getLogger('access'); //记录所有访问级别的日志
var errorLogger = log4js.getLogger('error'); //记录所有错误级别的日志
var dbLoger = log4js.getLogger('application');  //记录所有应用级别的日志

module.exports = {dbLoger,errorLogger,accessLogger};