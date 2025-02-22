const fs = require('fs');
const path = require('path');
const util = require('util');
const pdf = require('pdf-poppler');
const gm = require('gm').subClass({ imageMagick: true });

// Promise化方法
const mkdirAsync = util.promisify(fs.mkdir);
const unlinkAsync = util.promisify(fs.unlink);
const pdfConvert = util.promisify(pdf.convert);

module.exports = {
  /**
   * 核心转换方法
   * @param {Object} params 
   * @returns {Promise<string>} JPG访问路径
   */
  async convert({ pdfPath, reqid, outputDir }) {
    try {
      // 1. 创建输出目录
      if (!fs.existsSync(outputDir)) {
        await mkdirAsync(outputDir, { recursive: true });
      }

      // 2. 定义路径
      const tempFile = path.join(outputDir, `${reqid}-1.jpg`);
      const finalFile = path.join(outputDir, `${reqid}.jpg`);
      const publicUrl = `/images/reports/${reqid}.jpg`;

      // 3. 转换PDF
      await pdfConvert({
        format: 'jpeg',
        out_dir: outputDir,
        out_prefix: reqid,
        page: 1,
        path: pdfPath
      });

      // 4. 处理图片
      await new Promise((resolve, reject) => {
        gm(tempFile)
          .quality(75)
          .resize(1024)
          .write(finalFile, (err) => {
            err ? reject(err) : resolve();
          });
      });

      // 5. 清理临时文件
      await unlinkAsync(tempFile);

      return publicUrl;
    } catch (err) {
      throw new Error(`PDF转换失败: ${err.message}`);
    }
  }
};