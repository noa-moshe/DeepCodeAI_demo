// Commit: https://github.com/VizGrimoire/VizGrimoireJS/commit/89f7942d7019af8f8bd25110083b2de89f5f4104#diff-1672fa43c421d1f2607aeb5c005c344d89d2369e0ed351d90fadb6147c2cf2f7L120
// File: https://github.com/VizGrimoire/VizGrimoireJS/blob/7a9c69671d9b5a86b3a2181629300833fe46c9ef/rest/routes/grimoire.js
// Model: .227
/*
 * Grimoire REST interface
 */

var url = require('url');

// Database connection
var mysql = require('mysql');
var connection = mysql.createConnection({
    user : 'root',
    password : '',
    database : ''
});
connection.connect();

// Pagination
var items_page = 50;
var max_items_page = 500;

function toGrimoireEvolJSON(rows) {
    var field = '';
    if (rows[0].commits) field = 'commits';
    if (rows[0].authors) field = 'authors';
    var data = {id:[],date:[]};
    data[field]=[];
    for (var i =0; i<rows.length; i++) {
        data.id.push(rows[i].id);
        data.date.push(rows[i].date);
        data[field].push(rows[i][field]);
    }
    return data;
}

function sendRes (req, res, rows, evol) {
    var url_parts = url.parse(req.url, true);    
    var query = url_parts.query;

    if (query && query.callback) {
        res.writeHead(200, {'Content-Type' : 'application/javascript'});
        if (evol)
            res.end(query.callback + '(' + 
                JSON.stringify(toGrimoireEvolJSON(rows)) + ')');
        else
            res.end(query.callback + '(' + 
                    JSON.stringify(rows) + ')');
    }
    else {
        res.writeHead(200, {'Content-Type' : 'application/json'});
        if (evol)
            res.end(JSON.stringify(toGrimoireEvolJSON(rows)));
        else
            res.end(JSON.stringify(rows));
    }
}

function sendSQLRes(db, sql_query, req, res, evol) {
    connection.query("USE "+db, function(err, usedb, fields) {
        if (err) {
            console.log("Can't connect to " + db);
            res.send(err);
            return;
        }
        connection.query(sql_query, function(err, rows, fields) {
            sendRes(req, res, rows, evol);
        });
    });
}

function sqlPageFilter(start,end,limit,offset) {
    var sql = '';
    if (start || end) sql += " WHERE ";
    if (start) sql += "date>'" + start +"'";
    if (start && end) sql += " AND ";
    if (end) sql += "date<'" + end + "'";
    if (limit>max_items_page) limit = max_items_page;
    sql += " LIMIT " + limit;    
    if (offset) sql += " OFFSET " + offset;
    return sql;    
}

function addPageFilterInfo(data,start,end,limit,offset) {
    data.limit = limit;
    data.offset = offset;
    data.start = start;
    data.end = end;    
}

function evolSCMSql(label, field) {    
    var sql = "" +
    "SELECT m.id AS id, m.year AS year, m.month AS month, "+
    "DATE_FORMAT(m.date, '%b %Y') AS date, "+
    "IFNULL(cm."+label+", 0) AS " + label + " " +
    "FROM  months m "+
    "LEFT JOIN ("+
    " SELECT year(s.date) as year, month(s.date) as month, "+ 
    "  COUNT(DISTINCT(s."+field+")) AS " + label + " "+
    " FROM scmlog s "+
    " GROUP BY YEAR(s.date), MONTH(s.date) "+
    " ORDER BY YEAR(s.date), month(s.date)" +
    ") AS cm "+
    "ON (m.year = cm.year AND m.month = cm.month);";
    console.log(sql);
    return sql;
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
    sql += sqlPageFilter(start,end,limit,offset);
    console.log(sql);
    connection.query("USE "+db, function(err, usedb, fields) {
        if (err) {
            console.log("Can't connect to " + db);
            res.send(err);
            return;
        }
        connection.query(sql, function(err, rows, fields) {
            var sql_total = "SELECT COUNT(id) AS total_authors FROM people";
            connection.query(sql_total, function(err, rows1, fields) {
                addPageFilterInfo(rows1[0],start,end,limit,offset);
                rows.push(rows1[0]);
                sendRes(req, res, rows, evol);
            });
        });
    });
};
exports.authorsfindById = function(req, res) {
    var evol = false;
    var sql = "SELECT * FROM people where id = " + req.params.id;
    sendSQLRes(req.params.db, sql, req, res, evol);
};
exports.authors_evol = function(req, res) {
    var evol = true;
    var sql = evolSCMSql("authors","author_id");     
    sendSQLRes(req.params.db, sql, req, res, evol);
};

exports.commits = function(req, res) {
    var db = req.params.db;
    var evol = false;
    var start = req.query.start;
    var end = req.query.end;
    var offset = req.query.offset;
    if (!offset) offset = 0;
    var limit = req.query.limit;
    if (!limit) limit = items_page;
    var sql = "SELECT * FROM scmlog";
    sql += sqlPageFilter(start,end,limit,offset);
    connection.query("USE "+db, function(err, usedb, fields) {
        if (err) {
            console.log("Can't connect to " + db);
            res.send(err);
            return;
        }
        connection.query(sql, function(err, rows, fields) {
            var sql_total = "SELECT COUNT(id) AS total_commits FROM scmlog";
            connection.query(sql_total, function(err, rows1, fields) {
                addPageFilterInfo(rows1[0],start,end,limit,offset);
                rows.push(rows1[0]);
                sendRes(req, res, rows, evol);
            });
        });
    });
};
exports.commitsfindById = function(req, res) {
    var evol = false;
    var sql = "SELECT * FROM scmlog where id = " + req.params.id;
    sendSQLRes(req.params.db, sql, req, res, evol);
};
exports.commits_evol = function(req, res) {
    var evol = true;
    var sql = evolSCMSql("commits","id");
    sendSQLRes(req.params.db, sql, req, res, evol);
};

exports.companies = function(req, res) {
    res.send("companies " + req.query.start + " " + req.query.end);
};
exports.companiesfindById = function(req, res) {
    res.send("company JSON by Id");
};
exports.companies_evol = function(req, res) {
    res.send("respond with a companies-evol in JSON");
};

exports.dbs = function(req, res) {
    var evol = false;
    connection.query("SHOW DATABASES", function(err, rows, fields) {
        var scmdbs = [];
        for (var i=0; i<rows.length; i++) {
            if (rows[i].Database.indexOf('cvsanaly')>-1) scmdbs.push(rows[i]);
        }
        sendRes(req, res, scmdbs, evol);
    });
};

exports.repos = function(req, res) {
    res.send("repos " + req.query.start + " " + req.query.end);
};
exports.reposfindById = function(req, res) {
    res.send("repo JSON by Id");
};
exports.repos_evol = function(req, res) {
    res.send("respond with a repos-evol in JSON");
};

// HTML contents for API doc
exports.index = function(req, res) {
    res.render('rest', {
        title : 'Grimoire REST API'
    });
};
