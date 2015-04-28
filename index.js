var express = require('express');
var multer = require('multer');
var LRU = require('lru-cache');
var objectAssign = require('object-assign');
var debug = require('debug')('filebin');
var del = require('del');

module.exports = function(options) {
  options = options || {};
  options.forceClean = (options.forceClean === false) ? false : true;
  options.baseUrl = options.baseUrl || 'http://localhost';
  options.multerOptions = options.multerOptions || {};
  options.lruOptions = options.lruOptions || {};
  options.multerOptions = objectAssign({
    dest: '/run/shm/upoloads',
    limits: {
      fieldNameSize: 100,
      fileSize: 1024 * 1024 * 100,
      files: 10,
      fields: 10
    },
    onFileSizeLimit: function(file) {
      debug('onFileSizeLimit: ' + file.originalname);

      // delete the partially written file
      del(file.path, {force: true});
    },

    onError: function(error, next) {
      console.error(error);
      next(error);
    }
  }, options.multerOptions);

  options.lruOptions = objectAssign({
    max: 50,
    maxAge: 60 * 60 * 1000,
    dispose: function(key, n) {
      debug('Dispose file: ', n);
      del(n.path, function() {
        debug('Delete:', n.path);
      });
    }
  }, options.lruOptions);

  // clean up
  if (options.forceClean) {
    del.sync(options.multerOptions.dest, {force: true});
  }

  var cache = LRU(options.lruOptions);
  var router = express.Router();
  router
    .use(multer(options.multerOptions))
    .post('/upload', function(req, res, next) {
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

        debug('cache.set: ', file);
        cache.set(hash, file);
      }

      if (response.length === 1) {
        response = response[0];
      }

      res.status(statusCode).json(response);
    })
    .get('/download/:id', function(req, res, next) {
      var id = req.params.id;
      var fileObj = cache.get(id);
      if (fileObj === undefined) {
        return res.status(404).json({message: 'File not found!'});
      }

      res.download(fileObj.path, fileObj.fieldname, function(err) {
        if (err) return next(err);
      });
    });

  return router;
};
