var express = require('express');
var multer = require('multer');
var LRU = require('lru-cache');
var objectAssign = require('object-assign');
var debug = require('debug')('filebin');
var del = require('del');

var onUpload = function(req, res, next) {
  res.status(req.upload.code).json(req.upload.response);
};

var onDownload = function(req, res, next) {
  res.download(req.download.file.path,
    req.download.file.fieldname, function(err) {
    if (err) return next(err);
  });
};

module.exports = function(options) {
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

  // LRU config
  options.lruOptions = objectAssign({
    max: 50,
    maxAge: 60 * 60 * 1000,
    dispose: function(key, n) {
      debug('Dispose file', n);
      del(n.path, function() {
        debug('Delete', n.path);
      });
    }
  }, options.lruOptions);

  // clean up
  if (options.forceClean) {
    del.sync(options.uploadOptions.dest, {force: true});
  }

  var uploadHandler = function(req, res, next) {
    var response = [];
    var statusCode = 200;
    for (var index in req.files) {
      var file = req.files[index];
      var hash = file.filename;

      response.push({
        fieldname: file.fieldname,
        physicalPath: file.path,
        url: options.baseUrl + '/download/' + hash
      });

      debug('cache.set', file);
      cache.set(hash, file);
    }

    if (response.length === 1) {
      response = response[0];
    }

    req.upload = {
      code: statusCode,
      response: response
    }

    next();
  };

  var downloadHandler =  function(req, res, next) {
    var id = req.params.id;
    var fileObj = cache.get(id);
    if (fileObj === undefined) {
      return res.status(404).json({message: 'File not found!'});
    }

    req.download = {
      file: fileObj
    };

    next();
  };

  var errorHandler = function(err, req, res, next) {
    if (!err) return next();
    res.status(400).json({message: 'File exceeds configured limit.'});
  }

  var cache = LRU(options.lruOptions);
  var router = express.Router();
  var uploader = multer(options.uploadOptions);

  router
    .post(options.uploadPath, uploader.any(), uploadHandler, onUpload)
    .put(options.uploadPath, uploader.any(), uploadHandler, onUpload)
    .get(options.downloadPath, downloadHandler, onDownload)
    .use(errorHandler);

  return router;
};
