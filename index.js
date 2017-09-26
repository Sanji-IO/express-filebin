const express = require('express');
const multer = require('multer');
const objectAssign = require('object-assign');
const debug = require('debug')('filebin');
const del = require('del');
const LRUHandler = require('./handlers/local-lru-handler');
const S3Handler = require('./handlers/s3-handler');

const onUpload = function (req, res, next) {
  res.status(req.upload.code).json(req.upload.response);
};

const onDownload = function (req, res, next) {
  res.download(req.download.file.path,
    req.download.file.fieldname, function (err) {
    if (err) return next(err);
  });
};

const errorHandler = function (err, req, res, next) {
  if (!err) return next();
  console.error(err);
  res.status(500).json({ message: 'something wrong, please check server log' });
};

const reqErrHandler = function (err, req, res, next) {
  if (!err) return next();
  console.error(err);
  res.status(400).json({ message: err.message });
};

module.exports = function (options) {
  options = options || {};
  options.handler = options.handler || 'lru';
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

  const router = express.Router();
  const uploader = multer(options.uploadOptions);
  var handler;
  if (options.handler === 'lru') {
    handler = LRUHandler(options);
  } else if (options.handler === 's3') {
    handler = S3Handler(options);
  }

  router
    .post(options.uploadPath, uploader.any(), reqErrHandler, handler.uploadHandler, onUpload)
    .put(options.uploadPath, uploader.any(), reqErrHandler, handler.uploadHandler, onUpload)
    .get(options.downloadPath, handler.downloadHandler, onDownload)
    .use(errorHandler);

  return router;
};
