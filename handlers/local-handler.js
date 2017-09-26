const debug = require('debug')('filebin:local-handler');
const objectAssign = require('object-assign');
const LRU = require('lru-cache');
const del = require('del');

module.exports = function (options) {
  // LRU config
  options.lruOptions = objectAssign({
    max: +process.env.LOCAL__MAX || 50,
    maxAge: +process.env.LOCAL__MAX__AGE || 60 * 60 * 1000,
    dispose: function (key, n) {
      debug('Dispose file', n);
      del(n.path, function () {
        debug('Delete', n.path);
      });
    }
  }, options.lruOptions);

  var cache = LRU(options.lruOptions);
  var uploadHandler = function (req, res, next) {
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
    };

    next();
  };

  var downloadHandler =  function (req, res, next) {
    var id = req.params.id;
    var fileObj = cache.get(id);
    if (fileObj === undefined) {
      return res.status(404).json({ message: 'File not found!' });
    }

    req.download = {
      file: fileObj
    };

    next();
  };

  return {
    uploadHandler: uploadHandler,
    downloadHandler: downloadHandler
  };
};
