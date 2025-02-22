// file.js

//客户端调用方法 https://blog.csdn.net/lixiaosenlin/article/details/114931287

const Koa = require('koa');
const Router = require('koa-router');
const koastatic = require('koa-static');
const fs = require('fs');
const formidable = require('formidable');
const multiparty = require('multiparty');
const SparkMD5 = require('spark-md5');
const path = require('path');

const SERVER_PATH = path.resolve(__dirname, '..').replace(/\\/g,"/")+'/files';

let router = new Router();

router.prefix('/files');

//定义延迟函数
const delay = function delay(interval) {
    typeof interval !== 'number' ? interval = 1000 : null;
    return new Promise((resolve, reject) => {
        setTimeout(function () {
            resolve();
        }, interval);
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

//利用multiparty插件解析前端传来的form-data格式的数据，并上传至服务器
const multipartyUpload = function multipartyUpload(req, autoUpload) {
    let config = {
        maxFieldsSize: 200 * 1024 * 1024
    }
    if (autoUpload) config.uploadDir = SERVER_PATH;

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

//将传进来的文件数据写入服务器
//form-data格式的数据将以流的形式写入
//BASE64格式数据则直接将内容写入
const writeFile = function writeFile(serverPath, file, isStream) {
    console.log(serverPath);
    return new Promise((resolve, reject) => {
        if (isStream) {
            try {
                let readStream = fs.createReadStream(file.path);
                let writeStream = fs.createWriteStream(serverPath);
                readStream.pipe(writeStream);
                readStream.on('end', () => {
                    resolve({
                        result: true,
                        message: '上传成功！'
                    });
                });
            } catch (err) {
                resolve({
                    result: false,
                    message: err
                })
            }
        } else {
            fs.writeFile(serverPath, file.path, err => {
                if (err) {
                    resolve({
                        result: false,
                        message: err
                    })
                    return;
                }
                resolve({
                    result: true,
                    message: '上传成功！'
                });
            });
        }
    });
}

//上传单个文件（form-data），利用第三方插件multipary解析并上传
router.post('/upload_single_file', async (ctx, next) => {
    try {
        let {
            files
        } = await multipartyUpload(ctx.req, true);
        let file = (files && files.file.length) ? files.file[0] : {};
        ctx.body = {
            code: 0,
            message: '文件上传成功',
            originalFilename: file.originalFilename,
            serverPath: file.path //.replace(__dirname, HOSTNAME)
        }
    } catch (err) {
        ctx.body = {
            code: 1,
            message: '文件上传失败'
        }
    }
});

//上传单个文件（form-data），利用第三方插件解析但不直接上传，而是将文件重命名后再单独上传
router.post('/upload_single_formdata_rename', async (ctx, next) => {
    try {
        let {
            files,
            fields
        } = await multipartyUpload(ctx.req, false);
        let file = (files && files.file.length) ? files.file[0] : {};
        let filename = (fields && fields.filename.length) ? fields.filename[0] : '';
        const filePath = `${SERVER_PATH}/${filename}`;
        let isExist = await exists(filePath);
        if (isExist) {
            ctx.body = {
                code: 0,
                message: '文件已经存在',
                originalFilename: filename,
                serverPath: file.path  //.replace(__dirname, HOSTNAME)
            }
            return;
        }
        let obj = await writeFile(filePath, file, true);
        if (obj.result) {
            ctx.body = {
                code: 0,
                message: '文件上传成功',
                originalFilename: filename,
                serverPath: filePath //.replace(__dirname, HOSTNAME)
            }
        } else {
            ctx.body = {
                code: 0,
                message: '文件上传失败'
            }
        }
    } catch (ex) {
        ctx.body = {
            code: 0,
            message: ex
        }
    }
});


//解析post请求参数，content-type为application/x-www-form-urlencoded 或 application/josn
const parsePostParams = function parsePostParams(req) {
    return new Promise((resolve, reject) => {
        let form = new formidable.IncomingForm();
        form.parse(req, (err, fields) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(fields);
        });
    });
}

//BASE64上传，该方式只能上传小图片，大图片不建议使用这种方式会造成程序卡死，大图片使用form-data上传
router.post('/upload_base64', async (ctx, next) => {
    try {
        let {
            file,
            filename
        } = await parsePostParams(ctx.req);
        file = decodeURIComponent(file);
        const suffix = /\.([0-9a-zA-Z]+)$/.exec(filename)[1];
        let spark = new SparkMD5.ArrayBuffer();
        file = file.replace(/^data:image\/\w+;base64,/, "");
        file = Buffer.from(file, 'base64');
        spark.append(file);
        let filepath = `${SERVER_PATH}/${spark.end()}.${suffix}`;
        await delay();
        const isExists = await exists(filepath);
        if (isExists) {
            ctx.body = {
                code: 0,
                message: '文件已经存在',
                originalFilename: filename,
                serverPath: file.path//.replace(__dirname, HOSTNAME)
            }
            return;
        }
        let obj = await writeFile(filepath, file, false);
        if (obj.result) {
            ctx.body = {
                code: 0,
                message: '文件上传成功',
                originalFilename: filename,
                serverPath: filepath//.replace(__dirname, HOSTNAME)
            }
        } else {
            ctx.body = {
                code: 0,
                message: '文件上传失败'
            }
        }
    } catch (err) {
        console.log(err);
        ctx.body = {
            code: 0,
            message: err
        }
    }
});

//合并多个分片文件
const mergeFiles = function mergeFiles(hash, count) {
    return new Promise(async (resolve, reject) => {
        const dirPath = `${SERVER_PATH}/${hash}`;
        if (!fs.existsSync(dirPath)) {
            reject('还没上传文件，请先上传文件');
            return;
        }
        const filelist = fs.readdirSync(dirPath);
        if (filelist.length < count) {
            reject('文件还未上传完成，请稍后再试');
            return;
        }
        let suffix;
        filelist.sort((a, b) => {
            const reg = /_(\d+)/;
            return reg.exec(a)[1] - reg.exec(b)[1];
        }).forEach(item => {
            !suffix ? suffix = /\.([0-9a-zA-Z]+)$/.exec(item)[1] : null;
            //将每个文件读取出来并append到以hash命名的新文件中
            fs.appendFileSync(`${SERVER_PATH}/${hash}.${suffix}`, fs.readFileSync(`${dirPath}/${item}`));
            fs.unlinkSync(`${dirPath}/${item}`); //删除切片文件
        });

        await delay(1000); //等待1秒后删除新产生的文件夹
        fs.rmdirSync(dirPath);
        resolve({
            path: `${HOSTNAME}/upload/${hash}.${suffix}`,
            filename: `${hash}.${suffix}`
        })
    });
}

//大文件切片上传
router.post('/upload_chunk', async (ctx, next) => {
    try {
        let {
            files,
            fields
        } = await multipartyUpload(ctx.req, false);
        let file = (files && files.file[0]) || {};
        let filename = (fields && fields.filename[0]) || '';
        let [, hash] = /^([^_]+)_(\d+)/.exec(filename);
        const dirPath = `${SERVER_PATH}/${hash}`;
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        }
        const filePath = `${dirPath}/${filename}`;
        const isExists = await exists(filePath);
        if (isExists) {
            ctx.body = {
                code: 0,
                message: '文件已经存在',
                originalFilename: filename,
                serverPath: filePath.replace(__dirname, HOSTNAME)
            }
            return;
        }
        let obj = await writeFile(filePath, file, true);
        if (obj.result) {
            ctx.body = {
                code: 0,
                message: '文件上传成功',
                serverPath: filePath//.replace(__dirname, HOSTNAME)
            }
        } else {
            ctx.body = {
                code: 1,
                message: '文件上传失败',
                serverPath: filePath//.replace(__dirname, HOSTNAME)
            }
        }

    } catch (err) {
        ctx.body = {
            code: 1,
            message: err
        }
    }
});

//合并切片文件
router.post('/upload_merge', async (ctx, next) => {
    const {
        hash,
        count
    } = await parsePostParams(ctx.req);
    const {
        path,
        filename
    } = await mergeFiles(hash, count);
    ctx.body = {
        code: 0,
        message: '文件合并成功',
        path,
        filename
    }
});

//获取已上传的切片
router.get('/uploaded', async (ctx, next) => {
    try {
        const {
            hash
        } = ctx.request.query;
        const dirPath = `${SERVER_PATH}/${hash}`;
        const filelist = fs.readdirSync(dirPath);
        filelist.sort((a, b) => {
            const reg = /_([\d+])/;
            return reg.exec(a)[1] - reg.exec(b)[1];
        });
        ctx.body = {
            code: 0,
            message: '获取成功',
            filelist: filelist || []
        }
    } catch (err) {
        ctx.body = {
            code: 0,
            message: '获取失败',
            filelist: []
        }
    }
});

module.exports = router;