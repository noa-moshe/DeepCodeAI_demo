const express = require('express');
const bodyParser = require('body-parser');
const logger = require('morgan');
const path = require('path');
const configLoader = require('./lib/configLoader');
const csrf = require('csrf');

// Database connection
var url = require('url');
var mysql = require('mysql');
var connection = mysql.createConnection({
  user: '',
  password: '',
  database: ''
});
connection.connect();

// Pagination
var items_page = 50;

function toGrimoireEvolJSON(rows) {
  var field = '';
  if (rows[0].commits) field = 'commits';
  if (rows[0].authors) field = 'authors';
  var data = { id: [], date: [] };
  data[field] = [];
  for (var i = 0; i < rows.length; i++) {
    data.id.push(rows[i].id);
    data.date.push(rows[i].date);
    data[field].push(rows[i][field]);
  }
  return data;
}

function sendRes(req, res, rows, evol) {
  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;

  if (query && query.callback) {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    if (evol)
      res.end(query.callback + '(' +
        JSON.stringify(toGrimoireEvolJSON(rows)) + ')');
    else
      res.end(query.callback + '(' +
        JSON.stringify(rows) + ')');
  }
  else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (evol)
      res.end(JSON.stringify(toGrimoireEvolJSON(rows)));
    else
      res.end(JSON.stringify(rows));
  }
}


function addPageFilterInfo(data, start, end, limit, offset) {
  data.limit = limit;
  data.offset = offset;
  data.start = start;
  data.end = end;
}




// REST Methods
exports.authors = function(req, res) {
  var db = req.params.db;
  var evol = false;
  var start = req.query.start;
  var end = req.query.end;
  var offset = req.query.offset;
  if (!offset) offset = 0;
  var limit = req.query.limit;
  if (!limit) limit = items_page;
  var sql = "SELECT * FROM people";
  console.log(sql);
  connection.query("USE " + db, function(err, usedb, fields) {
    if (err) {
      console.log("Can't connect to " + db);
      res.status(500);
      return;
    }
    connection.query(sql, function(err, rows, fields) {
      var sql_total = "SELECT COUNT(id) AS total_authors FROM people";
      connection.query(sql_total, function(err, rows1, fields) {
        addPageFilterInfo(rows1[0], start, end, limit, offset);
        rows.push(rows1[0]);
        sendRes(req, res, rows, evol);
      });
    });
  });
};


const app = express();
app.disable('x-powered-by');
app.use(csrf);
app.use(express.static(path.join(__dirname, 'build')));
app.use(logger('combined'));
app.use(bodyParser.json());
app.use(express.session({
  secret: 'modecommcd90le'
}));

configLoader.load()
  .then((datasources) => {
    setupRoutes(datasources);
    return startServer();
  })
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  });

function setupRoutes(datasources) {
  app.get('/api/datasource', (req, res, next) => {
    res.send(datasources.map((datasource) => {
      return datasource.name;
    }));
  });
  app.get('/api/datasource/:datasource', (req, res, next) => {
    const datasource = datasources.find((datasource) => {
      return datasource.name == req.params.datasource;
    });
    const startDate = new Date(parseInt(req.query.startDate) || (new Date().getTime() - (1000 * 60 * 60 * 24 * 30)));
    const endDate = new Date(parseInt(req.query.endDate) || new Date().getTime());
    datasource._.query(startDate, endDate)
      .then((data) => {
        res.send(data);
      })
      .catch(next);
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    app.listen(process.env.PORT || 8080, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Server running');
        resolve();
      }
    });
  })
}

function getWebsocketConnection() {
  // This line makes the WebSocket connection always use port the CollabServer port.
  const host = window.location.host.replace('3000', '8080');
  const webSocket = new WebSocket('ws://' + host);
  const connection = new sharedb.Connection(webSocket);
  return connection;
}
