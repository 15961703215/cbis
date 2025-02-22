const MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
const Db = require('mongodb').Db;
Db.prototype.getObjectId = ObjectID;
const _ = require('lodash');
const Deasync = require('deasync');
const defaulfOptions = {
	host: 'localhost',
	port: 27017,
	db: 'test',
	max: 100,
	min: 1
};
var CRUD =   function(options){
	this.db = null;
	this.error = null;
	options = _.assign({}, defaulfOptions, options);
	let url = `mongodb://${options.host}:${options.port}/${options.db}`;
	MongoClient.connect(url,{auth:{user:options.user,password:options.pass}}, // useNewUrlParser: true,
		(err, client) => {
		if(err){
			this.error = err;
			console.log(err);
		}else{
			this.db = client.db(options.db);
		}
	});
	while(this.db ===  null && this.error === null) {
		Deasync.sleep(100);
	}
};
module.exports = CRUD;