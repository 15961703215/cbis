/**
 * Created By Center on 2018/2/3
 **/
const ShortId =require("../index");
const shortId =new ShortId();
// console.log(shortId.gen(13));
let list = new Set();
let start = +new Date();
// console.log(new Date().format("yyyy-MM-dd hh:mm:ss.S"));
for(let i =0 ;i< 1;i++){
	let id =shortId.gen(15);
	list.add(id);
	//console.log(id);
	console.log(shortId.getDate(id,"yyyy-MM-dd hh:mm:ss"));
}
console.log(+new Date()-start);
console.log(list.size);

/*let num = +new Date("2018-12-31 23:59:59");
console.log(num.toString(36));*/

