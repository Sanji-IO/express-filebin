const express = require('express');
const multer = require('multer');
const objectAssign = require('object-assign');
const debug = require('debug')('filebin');
const del = require('del');
const LocalHandler = require('./handlers/local-handler');
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
  options.handler = options.handler || process.env.HANDLER || 'local';
  options.forceClean = (options.forceClean === false) ? false : true;
  options.baseUrl = options.baseUrl || process.env.BASE_URL || 'http://localhost';
  options.uploadOptions = options.uploadOptions || {};
  options.uploadPath = options.uploadPath || process.env.UPLOAD_PATH || '/upload';
  options.downloadPath = options.downloadPath || process.env.DOWNLOAD_PATH || '/download/:id';

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
    dest: process.env.FILE__DEST || __dirname + '/uploads',
    limits: {
      fieldNameSize: +process.env.FILE__LIMITS__FIELDNAMESIZE || 100,
      fileSize: +process.env.FILE__LIMITS__FILESIZE || 1024 * 1024 * 100,
      files: +process.env.FILE__LIMITS__FILES || 5,
      fields: +process.env.FILE__LIMITS__FIELDS || 5
    }
  }, options.uploadOptions);

  // clean up
  if (options.forceClean) {
    del.sync(options.uploadOptions.dest, { force: true });
  }

  const router = express.Router();
  const uploader = multer(options.uploadOptions);
  var handler;
  if (options.handler === 'local') {
    handler = LocalHandler(options);
  } else if (options.handler === 's3') {
    handler = S3Handler(options);
  }

  router
    .post(options.uploadPath, uploader.any(), reqErrHandler,
      handler.uploadHandler, onUpload)
    .put(options.uploadPath, uploader.any(), reqErrHandler,
      handler.uploadHandler, onUpload)
    .get(options.downloadPath, handler.downloadHandler, onDownload)
    .use(errorHandler);

  return router;
};
