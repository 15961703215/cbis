/**
 * Created by dev on 16-11-16.
 */
var Redis = require('ioredis');
var redis = null;
function REDIS(host,port,pass) {
	if(!redis){
		redis = new Redis({
			port: port,          // Redis port
			host: host,   // Redis host
			family: 4,           // 4 (IPv4) or 6 (IPv6)
			password: pass,
			db: 0
		});
	}
	return redis;
}

module.exports  = REDIS;