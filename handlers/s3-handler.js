const debug = require('debug')('filebin:s3-handler');
const objectAssign = require('object-assign');
const LRU = require('lru-cache');
const del = require('del');
const S3 = require('aws-sdk/clients/s3');
const fs = require('fs');
const Promise = require('bluebird');

// ***REMOVED***
// ***REMOVED***

module.exports = function (options) {

  options.s3Options = options.s3Options || {};
  const s3Options = Object.assign({
    downloadLinkExpires: 60,
    accessKeyId: '',
    secretAccessKey: '',
    region: '',
    params: {
      Bucket: ''
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
        Tagging: 'uploader=express-filebin'
      })
      .promise()
      .then(function (data) {
        const presignedParams = {
          Key: filenameHash,
          Expires: s3Options.downloadLinkExpires
        };

        debug('get pre-signed download link for', data);
        return new Promise(function (resolve, reject) {
          s3.getSignedUrl('getObject', presignedParams, function(err, url) {
            if (err) return reject(err);
            resolve(url);
          });
        });
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
        code: statusCode,
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

  return {
    uploadHandler: uploadHandler
  };
};
