/**
 * Created by center ON 17-12-16
 */
function FormatOutput() {

}
FormatOutput.prototype={
	formatReqLog:function (req) { //格式化请求日志(共同)
		var method = req.method;
		//访问方法
		var logText = "request method: " + method + "\n";
		
		//请求原始地址
		logText += "request originalUrl:  " + req.originalUrl + "\n";
		//客户端ip
		logText += "request client ip:  " + req.ip + "\n";
		//请求参数
		if (method === 'GET') {
			logText += "request query:  " + JSON.stringify(req.query) + "\n";
			// startTime = req.query.requestStartTime;
		} else {
			logText += "request body: " + "\n" + JSON.stringify(req.body) + "\n";
		}
		return logText;
	},
	formatRes:function (ctx, resTime) { //格式化响应日志
		// 响应日志开始
		var logText = "\n" + "*************** response log start ***************" + "\n";
		// 添加请求日志
		logText += this.formatReqLog(ctx.request, resTime);
		// 响应状态码
		logText += "response status: " + ctx.status + "\n";
		//服务器响应时间
		logText += "response time: " + resTime + "\n";
		// 响应内容
		logText += "response body: " + JSON.stringify(ctx.body) + "\n";
		// 响应日志结束
		logText += "*************** response log end ***************" + "\n";
		return logText;
		
	},
	formatError:function (ctx, err, resTime) { //格式化错误日志
		
		//错误信息开始
		var logText = "\n" + "*************** error log start ***************" + "\n";
		
		//添加请求日志
		logText += this.formatReqLog(ctx.request);
		// 响应状态码
		logText += "response status: " + ctx.status + "\n";
		//错误code
		logText += "err status: " + err.status + "\n";
		//错误名称
		logText += "err name: " + err.name + "\n";
		//错误信息
		logText += "err message: " + err.message + "\n";
		//服务器响应时间
		logText += "response time: " + resTime + "\n";
		//错误详情
		// logText += "Location: " + err.stack.split(/\n/)[2] + "\n";
		logText += "err stack: " + err.stack + "\n";
		//错误信息结束
		logText += "*************** error log end ***************" + "\n";
		return logText;
	}
};
module.exports = FormatOutput;






