var app = require('express')();
var filebin = require('./index');
var filebinOptions = {
  baseUrl: process.env.BASE_URL || '/',
  uploadOptions: {
    dest: '/uploads',
    limits: {
      fileSize: 1024 * 1024 * 500
    }
  }
};

app.use(filebin(filebinOptions));

app.listen(parseInt(process.env.PORT), process.env.HOST, function () {
  console.log('Listening on ' + process.env.HOST + ':' + process.env.PORT);
});
