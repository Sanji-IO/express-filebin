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
  options.multerOptions = options.multerOptions || {};
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

  // Multer config
  options.multerOptions = objectAssign({
    dest: __dirname + '/uploads',
    limits: {
      fieldNameSize: 100,
      fileSize: 1024 * 1024 * 100,
      files: 10,
      fields: 10
    },

    onFileSizeLimit: function(file) {
      debug('onFileSizeLimit' + file.originalname);

      // delete the partially written file
      del(file.path, {force: true});
    },

    onError: function(error, next) {
      debug(error);
      next(error);
    }
  }, options.multerOptions);

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
    del.sync(options.multerOptions.dest, {force: true});
  }

  var uploadHandler = function(req, res, next) {
    var response = [];
    var statusCode = 200;
    for (var name in req.files) {
      var file = req.files[name];
      var hash = file.name.substring(0, 32);

      if (file.truncated) {
        response.push({
          field: name,
          message: 'File size exceeds configured limit.'
        });
        statusCode = 202;
        continue;
      }

      response.push({
        field: name,
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

  var cache = LRU(options.lruOptions);
  var router = express.Router();

  router
    .use(multer(options.multerOptions))
    .post(options.uploadPath, uploadHandler, onUpload)
    .put(options.uploadPath, uploadHandler, onUpload)
    .get(options.downloadPath, downloadHandler, onDownload);

  return router;
};
