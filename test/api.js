var should = require('chai').should();
var request = require('supertest');
var express = require('express');
var filebin = require('../index');
var del = require('del');
var fs = require('fs');
var sinon = require('sinon');

describe('Create two seperate instance', function() {
  it('should return different instance', function() {
    var instance1 = filebin();
    var instance2 = filebin();
    instance1.should.be.not.equal(instance2);
  });
});

describe('Upload and download files from given url', function() {
  var app;
  var fileHash;
  var clock = sinon.useFakeTimers();

  before(function() {
    del.sync(__dirname + '/uploads/*');
    app = express();
    app.use(filebin({
      multerOptions: {
        dest: __dirname + '/uploads'
      }
    }));
  });

  describe('[POST] /upload Upload file', function() {
    it('should respond 200 OK and create the file on server', function(done) {
      request(app)
        .post('/upload')
        .attach('firmware.zip', __dirname + '/api.js')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          var url = res.body.url;
          fileHash = url.substring(url.length - 32);
          done();
        });
    });
  });

  describe('[GET] /download/{hashvalue} Download previous uploaded file', function() {
    it('should download correct file', function(done) {
      request(app)
        .get('/download/' + fileHash)
        .expect(200)
        .expect('Content-Type', /application\/octet-stream/)
        .end(function(err, res) {
          if (err) throw err;
          res.headers['content-disposition']
            .should.be.equal('attachment; filename=\"firmware.zip\"');
          done();
        });
    });
  });

  describe('[GET] /download/{hashvalue} Download previous uploaded file (after n seconds)', function() {
    it('should respond 404 Not found due to timeout', function(done) {
      request(app)
        .get('/download/' + fileHash)
        .expect(404)
        .end(function(err, res) {
          if (err) throw err;

          // add some delya for async delete operation
          setTimeout(function() {
            require('fs').exists(__dirname + '/uploads/' + fileHash + '.js', function(exists) {
              if (!exists) {
                return done();
              }

              return done('file exists.');
            });
          }, 10);
        });

      clock.tick(9990000);
      clock.restore();
    });
  });
});

