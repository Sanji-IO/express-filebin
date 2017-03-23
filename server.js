var debug = require('debug')('filebinserver');
var app = require('express')();
var filebin = require('./index');
var fileMaxAge = parseInt(process.env.FILE_MAX_AGE || 60 * 60) * 1000;
var filebinOptions = {
  baseUrl: process.env.BASE_URL || '/',
  uploadOptions: {
    dest: '/uploads',
    limits: {
      fileSize: 1024 * 1024 * 500
    }
  },
  lruOptions: {
    maxAge: fileMaxAge
  }
};

debug(filebinOptions);

app.use(filebin(filebinOptions));

app.listen(parseInt(process.env.PORT), process.env.HOST, function () {
  console.log('Listening on ' + process.env.HOST + ':' + process.env.PORT);
});
