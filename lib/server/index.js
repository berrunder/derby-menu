var express = require('express');
var derby = require('derby');
var racerBrowserChannel = require('racer-browserchannel');
var liveDbMongo = require('livedb-mongo');
var MongoStore = require('connect-mongo')(express);
var app = require('../app');
var error = require('./error');

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

expressApp
  .use(express.favicon())
  // Gzip dynamically
  .use(express.compress())
  // Respond to requests for application script bundles
  .use(app.scripts(store))
  // Serve static files from the public directory
  .use(express.static(__dirname + '/../../public'))

  // Add browserchannel client-side scripts to model bundles created by store,
  // and return middleware for responding to remote client messages
  .use(racerBrowserChannel(store))
  // Add req.getModel() method
  .use(store.modelMiddleware())

  // Parse form data
  // .use(express.bodyParser())
  // .use(express.methodOverride())

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
  // Create an express middleware from the app's routes
  .use(app.router())
  .use(expressApp.router)
  .use(error());


// SERVER-SIDE ROUTES //

expressApp.all('*', function(req, res, next) {
  next('404: ' + req.url);
});
