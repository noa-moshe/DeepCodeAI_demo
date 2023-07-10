// Commit: https://github.com/devshelf/devshelf/commit/26ced15a9ce37de4d8a2d68a4a99ec3b514236cf#diff-e07d531ac040ce3f40e0ce632ac2a059d7cd60f20e61f78268ac3be015b3b28fL115
// File: https://github.com/devshelf/devshelf/blob/410c0ebb839e68fe9d0ec5889b3fa5eb05206e5c/app.js
// Model .227
/* Module dependencies */
var express = require('express')
	, gzippo = require('gzippo')
    , colors = require('colors')
    , fs = require('fs')
    , mustache = require('mustache')
    , everyauth = require('everyauth')
    , path = require('path')
    , MongoStore = require('connect-mongostore')(express)
    , geo = require('geoip-native')
    ;
/* /Module dependencies */


/* Global vars */
global.articlesData = {}; //all-data.json obj with articles by lang (articlesData.en/ru/etc)
global.articlesIDs = {}; //all-data.json ID lists by lang (articlesIDs.en/ru/etc)
global.tagLinks = {}; //global object with tag links

global.appDir = path.dirname(require.main.filename); //path to project dir

global.MODE = process.env.NODE_ENV || 'development';

global.app = express();
global.opts = require('./core/options/'); //Global options
global.commonOpts = require('./core/options/common-options.json'); //Common options with Front-end
/* /Global vars */


/*
* Data
* */

global.indexData = {};

global.indexData[global.opts.l18n.defaultLang] = JSON.parse(fs.readFileSync(__dirname + '/public/index.json', "utf8"));

//filling lang properties
global.opts.l18n.additionalLangs.map(function(item) {
    global.indexData[item] = JSON.parse(fs.readFileSync(__dirname + '/public/'+item+'/index.json', "utf8"));
});


/*
* Update local information from git hub and regenerate all-data.json
* */
var articlesJson = require('./core/generate-data');
require('./core/updateData');

//Preparing initial data on start
articlesJson.generateData();


// test
app.use(function (req, res, next) {

    var body = '';
//
    if (req.method == 'POST') {
        console.log('--> POST DETECTED')

        req.on('data', function (data) {
            console.log('Starting read..')
            body += data;
        });

        req.on('end', function () {
            console.log('Readed.');
            console.log(body);
        });
//
//
    };
//    console.log('session', req.session);
//    console.log('ip', req.ip);
//    console.log('method', req.method);

    next();
})



/**
* Session
*/
app.use(express.bodyParser())
   .use(express.cookieParser(global.opts.cookieSecret));

app.use(express.session({
    secret: global.opts.cookieSecret,
    store: new MongoStore({
        'db': 'sessions',
        host: global.opts.remoteDBhost,
        port: global.opts.remoteDBport
    })
}));


/**
* Localization & geoIP
 */
function langMiddleware(req, res, next) {
    // todo: dmitryl: geoapi predict part will be here

//    console.log('cookies:', req.cookies.lang);

    // there is listed countries who will has RU lang by default;
    var
        geodata = geo.lookup(req.ip),// req.ip
        RU = ['RU', 'KZ', 'BY', 'UA', 'AM', 'GE'];

    if (!req.cookies.lang && req.method === 'GET') {
            // setting language on first enter
//            req.session.lang = (~RU.indexOf(geodata.code))? 'ru' : global.opts.l18n.defaultLang;
            res.cookie('country', geodata.code, { maxAge: 3600000, httpOnly: false });
   }

   // keep executing the router middleware
   next();
};
app.use(langMiddleware);

app.post('/lang', function (req, res, next) {
    var currentLang = req.body.lang || global.opts.l18n.defaultLang;
    res.cookie('lang', currentLang, { maxAge: 3600000, httpOnly: false });
//    req.session.lang = currentLang || 'en';

    res.send();
});


/*
* auth module
* */

require('./core/auth');
app.use(everyauth.middleware());

var authDoneTpl = fs.readFileSync(__dirname+'/views/auth-done.html', "utf8");
app.get('/auth/stub', function (req, res) {
    var lang = req.cookies.lang || global.opts.l18n.defaultLang;

    var indexJson = global.indexData[lang];

    indexJson.authDone = false;

    var htmlToSend = mustache.to_html(authDoneTpl, indexJson);

    res.send(htmlToSend);
});

app.get('/auth/done', function (req, res) {
    var lang = req.cookies.lang || global.opts.l18n.defaultLang;

    //Creating cachedAuth for keeping auth after app restart
    req.session.authCache = req.session.auth;

    var indexJson = global.indexData[lang];

    indexJson.user = JSON.stringify(req.session.authCache.github.user);
    indexJson.authDone = true;

    var htmlToSend = mustache.to_html(authDoneTpl, indexJson);
    res.send(htmlToSend);
});


/*
 * git api form
 * */
require('./core/commit');


/**
* Validation
*/
var validation = require('./core/article-validate');
app.get('/validate', validation.articleValidate);


/**
* URL checker
*/
var check = require('./core/check-url-status');
app.get('/check-url', check.checkURLStatus);


/*
* web routing
* */
// Route for static files
app.set('route', __dirname + '/public');
app
	.use(gzippo.staticGzip(app.get('route')))
	.use(gzippo.compress());

//main page
app.get('/', function(req, res) {
    var lang = req.cookies.lang || global.opts.l18n.defaultLang;

    //text data
    var indexJson = {records:global.indexData[lang]};

    //for dynamic options update
    indexJson.commonOpts = global.commonOpts;

    //link to tags catalogues for main page
    indexJson.catalogue = global.tagLinks[lang];

    //Auth data
    indexJson.auth = (req.session.authCache && typeof req.session.authCache.github.user === 'object') || typeof req.user === 'object' ? true : false;


    //Preparing for client
    var clientIndexJson = {},
        clientIndexJsonFields = ['commonOpts','auth','records'];

    clientIndexJsonFields.map(function(item){
       clientIndexJson[item] = indexJson[item];
    });

    indexJson.appData = JSON.stringify(clientIndexJson);


    var indexPage = fs.readFileSync(__dirname + '/public/build/index.html', "utf8");
    var htmlToSend = mustache.to_html(indexPage, indexJson);

    res.send(htmlToSend);
});


/*
* voting module (requiring place matters)
* */
var voting = require('./core/voting');

if (global.opts.voting.enabled) {
    app.get('/plusVotes', voting.plusVotes); // post arguments: id, user
    app.get('/minusVotes', voting.minusVotes); // post arguments: id, user
    app.get('/getVotes', voting.getVotes); // post arguments: id
    app.get('/getAllVotes', voting.getAllVotes);
}

// Preparing initial data on start
voting.generateVotingData();


/*
* error hadnling
* */

if (MODE === 'production') {
    app.use(function(err, req, res, next) {
        console.log(err);
        res.send(404, '404');
    });

    app.use(function(err, req, res, next) {
        console.log(err);
        res.send(500, '500');
    });
}

var appPort = MODE === 'development' ? global.opts.app.devPort : global.opts.app.port;

app.listen(appPort);
var appPortString = appPort.toString();
console.log('[DevShelf] is working on '.blue + appPortString.blue + ' port in '.blue + MODE.blue + ' mode...'.blue);
