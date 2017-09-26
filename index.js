var express = require('express');
var multer = require('multer');
var objectAssign = require('object-assign');
var debug = require('debug')('filebin');
var del = require('del');
const LRUHandler = require('./handlers/local-lru-handler');

var onUpload = function (req, res, next) {
  res.status(req.upload.code).json(req.upload.response);
};

var onDownload = function (req, res, next) {
  res.download(req.download.file.path,
    req.download.file.fieldname, function (err) {
    if (err) return next(err);
  });
};

module.exports = function (options) {
  options = options || {};
  options.forceClean = (options.forceClean === false) ? false : true;
  options.baseUrl = options.baseUrl || 'http://localhost';
  options.uploadOptions = options.uploadOptions || {};
  options.lruOptions = options.lruOptions || {};
  options.uploadPath = options.uploadPath || '/upload';
  options.downloadPath = options.downloadPath || '/download/:id';

  if (!options.onUpload || typeof (options.onUpload) !== 'function') {
    debug('Use default onUpload');
    options.onUpload = onUpload;
  }

  if (!options.onDownload || typeof (options.onDownload) !== 'function') {
    debug('Use default onDownload');
    options.onDownload = onDownload;
  }

  // Upload config
  options.uploadOptions = objectAssign({
    dest: __dirname + '/uploads',
    limits: {
      fieldNameSize: 100,
      fileSize: 1024 * 1024 * 100,
      files: 5,
      fields: 5
    }
  }, options.uploadOptions);

  // clean up
  if (options.forceClean) {
    del.sync(options.uploadOptions.dest, { force: true });
  }

  var errorHandler = function (err, req, res, next) {
    if (!err) return next();
    console.error(err);
    res.status(400).json({ message: 'something wrong, please check server log' });
  };

  var router = express.Router();
  var uploader = multer(options.uploadOptions);
  var lruHandler = LRUHandler(options);

  router
    .post(options.uploadPath, uploader.any(), lruHandler.uploadHandler, onUpload)
    .put(options.uploadPath, uploader.any(), lruHandler.uploadHandler, onUpload)
    .get(options.downloadPath, lruHandler.downloadHandler, onDownload)
    .use(errorHandler);

  return router;
};
