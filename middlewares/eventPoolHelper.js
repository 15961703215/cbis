Date.prototype.format = function (fmt) { //author: meizz
	var o = {
		"M+": this.getMonth() + 1, //月份
		"d+": this.getDate(), //日
		"h+": this.getHours(), //小时
		"m+": this.getMinutes(), //分
		"s+": this.getSeconds(), //秒
		"q+": Math.floor((this.getMonth() + 3) / 3), //季度
		"S": this.getMilliseconds() //毫秒
	};
	if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
	for (var k in o)
		if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
	return fmt;
};

var Event = (function(){
	var clientList = {},
		listen,
		trigger,
		remove;
	listen = function( key, fn ){
		if ( !clientList[ key ] ){
			clientList[ key ] = [];
		}
		clientList[ key ].push( fn );
	};
	trigger = function(){
		var key = Array.prototype.shift.call( arguments ),
			fns = clientList[ key ];
		if ( !fns || fns.length === 0 ){
			return false;
		}
		for( var i = 0, fn; fn = fns[ i++ ]; ){
			fn.apply( this, arguments );
		}
	};
	remove = function( key, fn ){
		var fns = clientList[ key ];
		if ( !fns ){
			return false;
		}
		if ( !fn ){
			fns && ( fns.length = 0 );
		}else{
			for ( var l = fns.length - 1; l >=0; l-- ){
				var _fn = fns[ l ];
				if ( _fn === fn ){
					fns.splice( l, 1 );
					break;
				}
			}
		}
	};
	return {
		listen: listen,
		trigger: trigger,
		remove: remove
	}
})();
exports.listen = Event.listen;
exports.trigger = Event.trigger;
exports.operate=function (key,info,delayTime) {
	return new Promise(function(resolve, reject) {
		var backFun = function (message) {
			console.log((new Date()).format("yyyy-M-d h:m:s.S ") + "apiServer 收到netServer 回复...");
			console.log(message);
			clearTimeout(time);
			var data = JSON.parse(message);
			if(data.gId == info.gId){
				resolve(data);
				Event.remove(key,backFun);
			}else{
				var error = new Error("操作超时");
				error.number = 1001;
				reject(error);
			}
			Event.remove(key,backFun);
		};
		Event.listen(key,backFun);
		var time = setTimeout(function () {
			var error = new Error("操作超时");
			error.number = 1001;
			reject(error);
			Event.remove(key,backFun);
		},delayTime?delayTime:20000);
	});
};