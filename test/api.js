const should = require('chai').should();
const request = require('supertest');
const express = require('express');
const filebin = require('../index');
const del = require('del');
const fs = require('fs');
const sinon = require('sinon');
const url = require('url');
const S3rver = require('s3rver');
const mkdirp = require('mkdirp');

describe('Create two seperate instance', function () {
  it('should return different instance', function () {
    var instance1 = filebin();
    var instance2 = filebin();
    instance1.should.be.not.equal(instance2);
  });
});

describe('Upload and download files from given url (LRU)', function () {
  var app;
  var fileHash;

  before(function () {
    del.sync(__dirname + '/uploads/*');
    app = express();
    app.use(filebin({
      uploadOptions: {
        dest: __dirname + '/uploads'
      }
    }));
  });

  describe('[POST] /upload Upload file', function () {
    it('should respond 200 OK and create the file on server', function (done) {
      request(app)
        .post('/upload')
        .attach('firmware.zip', __dirname + '/api.js')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          if (err) throw err;
          var url = res.body.url;
          fileHash = url.substring(url.length - 32);
          done();
        });
    });
  });

  describe('[POST] /upload Upload multiple files', function () {
    it('should respond 200 OK and create the file on server', function (done) {
      request(app)
        .post('/upload')
        .attach('firmware.zip', __dirname + '/api.js')
        .attach('firmware2.zip', __dirname + '/api.js')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          if (err) throw err;
          console.log(JSON.stringify(res.body));
          done();
        });
    });
  });

  describe('[GET] /download/{hashvalue} Download previous uploaded file', function () {
    it('should download correct file', function (done) {
      request(app)
        .get('/download/' + fileHash)
        .expect(200)
        .expect('Content-Type', /application\/octet-stream/)
        .end(function (err, res) {
          if (err) throw err;
          res.headers['content-disposition']
            .should.be.equal('attachment; filename=\"firmware.zip\"');
          done();
        });
    });
  });

  describe('[GET] /download/{hashvalue} Download previous uploaded file (after n seconds)', function () {
    var clock = sinon.useFakeTimers();
    clock.tick(9990000);
    it('should respond 404 Not found due to timeout', function (done) {
      request(app)
        .get('/download/' + fileHash)
        .expect(404)
        .end(function (err, res) {
          if (err) throw err;

          // add some delay for async delete operation
          setTimeout(function () {
            require('fs').exists(__dirname + '/uploads/' + fileHash + '.js', function (exists) {
              if (!exists) {
                return done();
              }

              return done('file exists.');
            });
          }, 10);
        });
      clock.restore();
    });
  });
});

describe('[POST] /upload Upload file that exceed the size', function () {
  var app;
  var fileHash;

  before(function () {
    del.sync(__dirname + '/uploads/*');
    app = express();
    app.use(filebin({
      uploadOptions: {
        dest: __dirname + '/uploads',
        limits: {
          fileSize: 100
        }
      }
    }));
  });

  it('should respond 400 Bad request', function (done) {
    request(app)
      .post('/upload')
      .attach('firmware.zip', __dirname + '/api.js')
      .attach('ttt.zip', __dirname + '/../.jscsrc')
      .expect(400)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        if (err) throw err;
        done();
      });
  });
});


describe('Upload and download files from given url (S3)', function () {
  var app;
  var s3Server;
  var downloadUrl;

  before(function (done) {
    del.sync(__dirname + '/uploads/*');
    app = express();
    app.use(filebin({
      handler: 's3',
      s3Options: {
        accessKeyId: '1234',
        secretAccessKey: '5678',
        endpoint: 'http://localhost:5566',
        s3BucketEndpoint: false,
        use_ssl: false,
        s3ForcePathStyle: true,
        params: {
          Bucket: 'test-bucket'
        }
      },
      uploadOptions: {
        dest: __dirname + '/uploads'
      }
    }));

    mkdirp.sync('/tmp/s3/test-bucket');
    s3Server = new S3rver({
        port: 5566,
        hostname: 'localhost',
        silent: false,
        directory: '/tmp/s3'
    }).run(function (err, host, port) {
        if(err) return done(err);
        done();
    });
  });

  describe('[POST] /upload Upload file', function () {
    it('should respond 200 OK and create the file on server', function (done) {
      request(app)
        .post('/upload')
        .attach('firmware.zip', __dirname + '/api.js')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          if (err) throw err;
          const parsedUrl = url.parse(res.body.url);
          downloadUrl = parsedUrl.path;
          done();
        });
    });
  });

  describe('[GET] /download/{hashvalue} Download previous uploaded file', function () {
    it('should download correct file', function (done) {
      request(s3Server)
        .get(downloadUrl)
        .expect(200)
        .expect('Content-Type', /application\/octet-stream/)
        .end(function (err, res) {
          if (err) throw err;
          console.log(res.headers);
          res.headers['content-disposition']
            .should.be.equal('attachment; filename=\"firmware.zip\"');
          done();
        });
    });
  });
});
