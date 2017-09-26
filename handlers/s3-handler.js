const debug = require('debug')('filebin:s3-handler');
const objectAssign = require('object-assign');
const LRU = require('lru-cache');
const del = require('del');
const S3 = require('aws-sdk/clients/s3');
const fs = require('fs');
const Promise = require('bluebird');

module.exports = function (options) {

  options.s3Options = options.s3Options || {};
  const s3Options = Object.assign({
    downloadLinkExpires: +process.env.S3__PRESIGNED__EXPIRES || 1209600,
    accessKeyId: process.env.S3__ACCESSKEYID,
    secretAccessKey: process.env.S3__SECRETACCESSKEY,
    region: process.env.S3__REGION,
    params: {
      Bucket: process.env.S3__PARAMS__BUCKET
    }
  }, options.s3Options);

  const s3 = new S3(s3Options);
  var uploadHandler = function (req, res, next) {
    Promise.map(req.files, function (file) {
      const filenameHash = file.filename;
      var fileinfo = {
        fieldname: file.fieldname,
        physicalPath: file.path
      };

      return s3.upload({
        ACL: 'bucket-owner-full-control',
        Body: fs.createReadStream(file.path),
        Key: filenameHash,
        ContentDisposition: `attachment; filename="${fileinfo.fieldname}"`,
        Tagging: 'uploader=express-filebin'
      })
      .promise()
      .then(function (data) {
        const presignedParams = {
          Key: filenameHash,
          Expires: s3Options.downloadLinkExpires
        };

        debug('get pre-signed download link for', data);
        return del(file.path).then(function () {
          debug('temp file deleted', file.path);
          return new Promise(function (resolve, reject) {
            s3.getSignedUrl('getObject', presignedParams, function(err, url) {
              if (err) return reject(err);
              resolve(url);
            });
          });
        })
      })
      .then(function(url) {
        fileinfo.url = url;
        return fileinfo;
      });
    })
    .then(function(response) {
      if (response.length === 1) {
        response = response[0];
      }

      req.upload = {
        code: 200,
        response: response
      };

      debug('uploaded to s3', req.upload);
      next();
    })
    .catch(function(err) {
      debug('upload to s3 error', err);
      next(err);
    });
  };

  const downloadHandler = function (req, res, next) {
    return res.json({message: 'HANLDER=S3, please use s3 url directly.'});
  };

  return {
    uploadHandler: uploadHandler,
    downloadHandler: downloadHandler
  };
};
