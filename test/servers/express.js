'use strict';

const Server = require('./skeleton');

const {contrast_agent: agent, contrast_tracker: tracker} = global;

// the app
const express = require('express');
const app = express();

// create the routers
const stats = express.Router();
const echo = express.Router();
const read = express.Router();
const create = express.Router();
const stop = express.Router();

app.use('/', stats);
app.use('/', echo);
app.use('/', read);
app.use('/', create);
app.use('/', stop);

stats.use(express.json({limit: '50mb'}));
echo.use(express.json({limit: '50mb'}));
read.use(express.json({limit: '50mb'}));
create.use(express.json({limit: '50mb'}));


// predefined return values for the "create" path
const single = require('../data/json/single-key.json');
const many = require('../data/json/many-keys.json');
const big = require('../data/json/big-array.json');


// parses what should be a tracked object and stringifies it, returning
// stats but not the original object.
echo.post('/meta', function(req, res, next) {
  const protocol = req.socket.encrypted ? 'https' : 'http';
  const t_start = Date.now();
  const s = JSON.stringify(req.body);
  const response = {
    url: `${protocol}://${req.headers.host}`,
    bytes: s.length,
    stringifyTime: Date.now() - t_start,
    agent: !!agent,
    tracker: !!tracker,
  };
  if (tracker) {
    response.tracked = tracker.getData(s).tracked;
  }
  res.send(response);
});

// stringify the string and return it
echo.post('/echo', function(req, res, next) {
  const s = JSON.stringify(req.body);
  res.send(s);
});

// stringify the same string but not behind a membrane.
echo.post('/noecho/', function(req, res, next) {
  res.send(JSON.stringify(many));
});

read.post('/read', function(req, res, next) {
  const body = req.body;
  const keys = Object.keys(body);
  for (const k in keys) {
    const x = body[k];
    if (x === 'xyzzy') {
      body[k] = x.repeat(2);
    }
  }
  res.end(JSON.stringify({referenced: keys.length}));
  return;
});

// stringifies what should be an untracked object
create.post('/create', function(req, res, next) {
  const t_start = Date.now();
  let r;
  if (Array.isArray(req.body)) {
    r = big;
  } else {
    r = {
      'many-keys': many,
      'single-key': single
    }[req.body.name];
  }
  const s = JSON.stringify(r);
  const response = {
    bytes: s.length,
    stringifyTime: Date.now() - t_start,
    agent: !!agent,
    tracker: !!tracker
  };
  if (tracker) {
    response.tracked = tracker.getData(s).tracked;
  }
  res.send(response);
});

stop.post('/stop/:code', function(req, res, next) {
  process.exit(+req.params.code);
});

app.get('/info', function(req, res, next) {
  res.send(JSON.stringify({info: {useful: 'things'}}));
});

app.get('/random-wait', function(req, res, next) {
  const ms = Math.floor(Math.random() * 1000);
  setTimeout(() => {
    res.send({waited: ms});
  }, ms);
});

app.get('/wait/:time/:code?', function(req, res, next) {
  const time = +req.params.time;
  setTimeout(() => {
    if (req.params.code) {
      res.statusCode = +req.params.code;
      res.send({statusCode: 404, message: 'page not found'});
      return;
    }
    res.send({time});
  }, time);
});

//
// create the server and start listening.
//
let options;
if (process.argv.length > 2) {
  const protocols = Server.getProtocols(process.argv.slice(2));
  options = {protocols};
}
const server = new Server(app, options);

server.start()
  .then(n => {
    // eslint-disable-next-line no-console
    console.log(process.pid);
  });
