var express = require('express');
var multer = require('multer');
var LRU = require('lru-cache');
var objectAssign = require('object-assign');
var debug = require('debug')('filebin');
var del = require('del');

module.exports = function(options) {
  options = options || {};
  options.baseUrl = options.baseUrl || 'http://localhost';
  options.multerOptions = options.multerOptions || {};
  options.lruOptions = options.lruOptions || {};
  options.multerOptions = objectAssign({
    dest: '/run/shm/upoloads',
    limits: {
      fieldNameSize: 100,
      fileSize: 1024 * 100,
      files: 10,
      fields: 10
    },
    onFileSizeLimit: function(file) {
      debug('onFileSizeLimit: ' + file.originalname);

      // delete the partially written file
      fs.unlink('./' + file.path)
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

  var cache = LRU(options.lruOptions);
  var router = express.Router();
  router
    .use(multer(options.multerOptions))
    .post('/upload', function(req, res, next) {
      var response = [];
      for (var name in req.files) {
        var file = req.files[name];
        var hash = file.name.substring(0, 32);
        response.push({
          url: options.baseUrl + '/download/' + hash
        });

        debug('cache.set: ', file);
        cache.set(hash, file);
      }

      if (response.length === 1) {
        response = response[0];
      }

      res.json(response);
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
