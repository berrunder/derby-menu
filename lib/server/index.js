var express = require('express');
var derby = require('derby');
var racerBrowserChannel = require('racer-browserchannel');
var liveDbMongo = require('livedb-mongo');
var MongoStore = require('connect-mongo')(express);
var app = require('../app');
var error = require('./error');
var crypto = require('crypto');
var fs = require('fs');

var expressApp = module.exports = express();

var redisObserver;
// Get Redis configuration
if (process.env.REDIS_HOST) {
  var redis = require('redis').createClient(process.env.REDIS_PORT, process.env.REDIS_HOST);
  redis.auth(process.env.REDIS_PASSWORD);
  redisObserver = require('redis').createClient(process.env.REDIS_PORT, process.env.REDIS_HOST);
  redisObserver.auth(process.env.REDIS_PASSWORD);
} else if (process.env.REDISCLOUD_URL) {
  var redisUrl = require('url').parse(process.env.REDISCLOUD_URL);
  var redis = require('redis').createClient(redisUrl.port, redisUrl.hostname);
  redis.auth(redisUrl.auth.split(":")[1]);
  redisObserver = require('redis').createClient(redisUrl.port, redisUrl.hostname);
  redisObserver.auth(redisUrl.auth.split(":")[1]);
} else {
  var redis = require('redis').createClient();
  redisObserver = require('redis').createClient();
}
redis.select(process.env.REDIS_DB || 1);
// Get Mongo configuration 
var mongoUrl = process.env.MONGO_URL || process.env.MONGOHQ_URL ||
  'mongodb://localhost:27017/project';

// The store creates models and syncs data
var store = derby.createStore({ db: {
  db: liveDbMongo(mongoUrl + '?auto_reconnect', {safe: true})
, redis: redis
, redisObserver: redisObserver
}});

function createUserId(req, res, next) {
  var model = req.getModel();
  var userId = req.session.userId || (req.session.userId = model.id());
  model.set('_session.userId', userId);
  next();
}

/**
 * Express middleware for exposing the user to the model (accessible by the
 * server and browser only to the user, via model.get('_session.user').
 */
function rememberUser (req, res, next) {
    var model = req.getModel();
    var userId = req.session.userId;
    if (!userId) return next();
    var $me = model.at('users.' + userId);
    $me.fetch( function (err) {
        if (err) return next(err);
        model.ref('_session.user', $me.path());
        next();
    });
}

/**
 * Middleware for setting user rights
 */
function setRights(req, res, next) {
    if (req.session.asPlanner) return next();

    var model = req.getModel();
    var userId = req.session.userId;
    if (!userId) return next();
    var secure = model.at('secure.' + userId);
    if (!secure) return next();
    secure.fetch(function(err) {
        if (err) return next(err);
        var hashed = secure.get('hashed');
        if (!hashed) return next();
        var hashedToken = encryptPassword('hostAdmin', userId);
        if (hashedToken === hashed) {
            model.set('_session.asPlanner', true);
        }
        next();
    });
}

function encryptPassword(password, salt) {
    var hmac = crypto.createHmac('sha1', salt)
    hmac.write(password)
    hmac.end()
    hmac.setEncoding('hex')
    return hmac.read();
}

var oneYear = 31557600000;

expressApp
  .use(express.favicon())
  // Gzip dynamically
  .use(express.compress())
  // Respond to requests for application script bundles
  .use(app.scripts(store))
  // Serve static files from the public directory
  .use(express.static(__dirname + '/../../public'), { maxAge: oneYear })

  // Add browserchannel client-side scripts to model bundles created by store,
  // and return middleware for responding to remote client messages
  .use(racerBrowserChannel(store))
  // Add req.getModel() method
  .use(store.modelMiddleware())

  // Parse form data
  .use(express.bodyParser())
  .use(express.methodOverride())

  // Session middleware
  .use(express.cookieParser())
  .use(express.session({
    secret: process.env.SESSION_SECRET || 'MY LITTLE SECRET'
  , store: new MongoStore({url: mongoUrl, safe: true})
  , cookie: {
            maxAge: 3600000*24*7 // one week
        }
  }))
  .use(createUserId)
  .use(rememberUser)
  .use(setRights)
  // Create an express middleware from the app's routes
  .use(app.router())
  .use(expressApp.router)
  .use(error());


// SERVER-SIDE ROUTES //

expressApp.get('/api/courses', function(req, res) {
    var mongo = require('mongoskin');
    var db = mongo.db(mongoUrl, {safe: true});

    db.collection('courses').find({ name: { $ne: null } })
        .toArray(function (err, items) {
            var dump = [];
            items.forEach(function (item) {
                dump.push({ name: item.name, price: item.price, type: item.type });
            });
            return res.json(dump);
        });
});

expressApp.get('/api/loadCoursesFromFile', function(req, res, next) {
    var model = req.getModel();
    // load data from courses.json
    fs.readFile('courses.json', function(err, data) {
        if (err) return next(err);

        loadCourses(req, res, next, data);
    });
});

expressApp.post('/api/loadCourses', function(req, res, next) {
    if (req.files.courses.size > 1000000) return next();
    fs.readFile(req.files.courses.path, function(err, data) {
        if (err) return next(err);

        return loadCourses(req, res, next, data);
    });
});

function loadCourses(req, res, next, data) {
    var model = req.getModel();

    try {
        var courses = JSON.parse(data);
        console.log('courses count in file: ' + courses.length);
        courses.forEach(function(item) {
            model.add('courses', item);
        });
    } catch (e) {
        console.error('Error! ', e);
        return next(e);
    }

    return res.send(courses.length + ' loaded.');
}

expressApp.post('/login', function(req, res, next) {
    var userId = req.session.userId;
    if (!userId) return next();
    var password = req.body.password;
    if (!password) res.redirect('/login');

    var model = req.getModel();
    var hashed = encryptPassword(password, userId);
    model.set('secure.' + userId + '.hashed', hashed);
    return res.redirect('/');
});

var logout = function(req, res, next) {
    req.session.destroy();
    res.redirect('/');
};

expressApp.get('/logout', logout);
expressApp.post('/logout', logout);

expressApp.all('*', function(req, res, next) {
  next('404: ' + req.url);
});