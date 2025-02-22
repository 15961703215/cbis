/**
 * Created by center ON 17-12-11
 * NOTE: for PM2 support to work you'll need to install the pm2-intercom module
 * pm2 install pm2-intercom
 *  var logger = new log4js({appenders:{file:{filename:"../logs/api.log",maxLogSize:204800}},pm2InstanceVar: 'INSTANCE_ID_API'});
 */

const defaultOptions =
	{
		appenders: {
			console: {
				type: 'console',
				layout: {
					type: 'pattern',
					pattern: '%[%d{yyyy-MM-dd hh:mm:ss:SSS} pid:%x{pid} %c [%p]: %] %m',
					tokens: {
						pid: function () {
							return process.pid;
						}
					}
				}
			},
			file:{
				type: "file",
				filename : "./logs/app.log",
				maxLogSize : 100000, // 字节B 204800
				backups : 100,
				encoding: 'utf-8',
				// compress: true,
				layout: {
					type: 'pattern',
					pattern: '[%d{yyyy-MM-dd hh:mm:ss:SSS}] pid:%x{pid} [%p]:%m', //category:%c
					tokens: {
						pid: function () {
							return process.pid;
						}
					}
				}
			}
		},
		categories: {
			default:{appenders: ['console'], level: 'debug'},
			file:{appenders: ['file'], level: 'debug'}
		},
		pm2: true, // pm2 install pm2-intercom
		pm2InstanceVar: 'INSTANCE_ID_NET'
	};
const _ = require('lodash');
const log4js = require('log4js');
var LOGGER = function (options) {
	var options = _.merge({}, defaultOptions, options);
	log4js.configure(options);
	const logger = log4js.getLogger('file');
	return logger;
};
module.exports = LOGGER;