/**
 * Created By Center on 2018/2/3
 **/

function ShordId() {
	this.symbols = [
		'0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
		'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
		'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
		'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
		'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
this.symObject = {
	'0':'0','1':'1','2':'2', '3':'3', '4':'4', '5':'5', '6':'6', '7':'7', '8':'8', '9':'9' ,
	'a':'10', 'b':'11', 'c':'12', 'd':'13', 'e':'14', 'f':'15', 'g':'16', 'h':'17', 'i':'18', 'j':'19',
	'k':'20', 'l':'21', 'm':'22', 'n':'23', 'o':'24', 'p':'25', 'q':'26', 'r':'27', 's':'28', 't':'29',
	'u':'30', 'v':'31', 'w':'32', 'x':'33', 'y':'34', 'z':'35',
	'A':'36', 'B':'37', 'C':'38', 'D':'39', 'E':'40', 'F':'41', 'G':'42', 'H':'43', 'I':'44', 'J':'45', 'K':'46', 'L':'47', 'M':'48', 'N':'49',
	'O':'50', 'P':'51', 'Q':'52', 'R':'53', 'S':'54', 'T':'55', 'U':'56', 'V':'57', 'W':'58', 'X':'59', 'Y':'60', 'Z':'61'
}
}
ShordId.prototype = {
	gen: function (len,salts) {
		let _len = len || 8;
		_len = _len < 8?8:_len;
		let _salts = salts||2;
		let times = new Date();
		// console.log(times.format("yyyy-MM-dd hh:mm:ss.S"));
		let n = times.getFullYear();
		let conversion = n.toString(36); // 3 pcs
		n = times.getMonth();
		conversion += this.symbols[n];
		n = times.getDate();
		conversion += this.symbols[n];
		n = times.getHours();
		conversion += this.symbols[n];
		n = times.getMinutes();
		conversion += this.symbols[n];
		n = times.getSeconds();
		conversion += this.symbols[n];
		_len -=8;
		let salt =0;
		while(_len){
			for(let i=0;i<_salts;i++) {
				salt = Math.floor(Math.random() * 62);
			}
			conversion += this.symbols[salt];
			_len--;
		}
		return conversion;
	},
	getDate:function (str,fmt) {
		if(str.length < 8){
			return "";
		}
		let timeStr = str.slice(0,8);
		let o = {
			"M+": this.symObject[timeStr.substring(3,4)], //月份
			"d+": this.symObject[timeStr.substring(4,5)], //日
			"h+": this.symObject[timeStr.substring(5,6)], //小时
			"m+": this.symObject[timeStr.substring(6,7)], //分
			"s+": this.symObject[timeStr.substring(7,8)], //秒
		};
		if (/(y+)/.test(fmt)){
			let year = parseInt(timeStr.substring(0,3),36);
			fmt = fmt.replace(RegExp.$1, year);
		}
		for (let k in o) {
			if (new RegExp("(" + k + ")").test(fmt)) {
				fmt = fmt.replace(RegExp.$1, (1 === RegExp.$1.length) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
			}
		}
		return fmt;
	}

};
module.exports = ShordId;