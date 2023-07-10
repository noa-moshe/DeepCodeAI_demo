// Commit: https://github.com/alphagov/spotlight/commit/d5d8bdb714885ef6b265daac77dd13f4f1ae0ed8#diff-02bedb39cb8b25670e4e85144002f256b1a04373d239a9454a650ad1827a13ebL51
// File: https://github.com/alphagov/spotlight/blob/8e86def8975fb16542d471f27759b761f7f507a8/app/server.js
// Model: .227

var requirejs = require('requirejs');
var config = requirejs('./config');
config.baseUrl = 'app/';
config.nodeRequire = require;
requirejs.config(config);

var fs = requirejs('fs');
var argv = require('optimist').argv;

var express = require('express'),
    http = require('http'),
    path = require('path');


global.isServer = true;
global.requireBaseUrl = argv.REQUIRE_BASE_URL || '/limelight/js';


var $ = global.$ = global.jQuery = require('jquery');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
$.support.cors = true;
$.ajaxSettings.xhr = function () {
    return new XMLHttpRequest();
};


var rootDir = path.join(__dirname, '..');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.compress());
  app.use('/css', express.static(path.join(rootDir, 'public', 'css')));
});

app.configure('development', function(){

  app.use('/app', express.static(path.join(rootDir, 'app')));
  app.use('/.grunt', express.static(path.join(rootDir, '.grunt')));
  app.use('/test/spec', express.static(path.join(rootDir, 'test', 'spec')));
  app.use('/spec', function (req, res) {
    res.sendfile(path.join(rootDir, '_SpecRunner.html'));
  });
  app.use(express.errorHandler());

  app.get('/stagecraft-stub/*', function (req, res) {
    var paramPath = req.params[0],
        filePath = 'support/stagecraft_stub/responses/' + paramPath + '.json';
    if (fs.existsSync(filePath)) {
      var content = fs.readFileSync(filePath);
      res.send(JSON.parse(content));
    } else {
      res.send({error: "No such stub exists: " + filePath});
    }
  });
});

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});


exports = module.exports = server;

exports.use = function() {
	app.use.apply(app, arguments);
};
