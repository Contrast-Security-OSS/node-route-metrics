#!/usr/bin/env node
'use strict';

/**
 * tool to hit various end points on a server for testing and demos.
 *
 * the express and simple in test/servers/ implement these end points. run
 * either using `node test/servers/express.js http:localhost:8888
 */

const fs = require('fs');
const fetch = require('node-fetch');
const Server = require('../test/servers/server.js');

const asyncPoolSize = process.env.POOL || 10;
// make the following mutually exclusive with ITERATIONS.
// TIME_TO_RUN is in seconds.
let timeToRun = 0;
if ('TIME_TO_RUN' in process.env) {
  timeToRun = +process.env.TIME_TO_RUN * 1000;
}

// calculate these anyway but if timeToRun is truthy, they'll be
// ignored.
let min = +(process.env.MIN || 40);
let max = +(process.env.MAX || 80);
if (process.env.ITERATIONS) {
  min = max = +process.env.ITERATIONS;
}
const randomMinMax = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rmm = () => randomMinMax(min, max);

const targets = [
  {method: 'post', ep: '/echo', body: 'many-keys.json', n: rmm()},
  {method: 'post', ep: '/noecho', body: 'many-keys.json', n: rmm()},
  {method: 'get', ep: '/random-wait', n: rmm()},
  {method: 'post', ep: '/meta', body: 'many-keys.json', n: rmm()},
  {method: 'post', ep: '/read', body: 'many-keys.json', n: rmm()},
  {method: 'get', ep: '/info', n: rmm()},
  {method: 'get', ep: '/wait/10', n: rmm()},
  {method: 'get', ep: '/wait/100', n: rmm()},
  {method: 'get', ep: '/wait/10/404', n: rmm()},
  {method: 'post', ep: '/noecho?name=ralph', body: 'many-keys.json', n: rmm()},
  {method: 'post', ep: '/noecho?name=alice', body: 'many-keys.json', n: rmm()},
];

let verbose = false;
const args = process.argv.slice(2);

// if the user specifies a server, then start it here.
let server;
// routes are specified by the ep without the leading slash
const requests = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-v') {
    verbose = true;
    continue;
  }
  if (args[i] === '-s' || args[i] === '--server') {
    if (args[i + 1] !== 'express' && args[i + 1] !== 'simple') {
      // eslint-disable-next-line no-console
      console.error('server must be express or simple');
      process.exit(1);
    }
    server = args[++i];
    continue;
  }
  let t;
  if (t = targets.find(t => t.ep.endsWith(args[i]))) {
    requests.push(Object.assign({}, t));
  } else {
    // eslint-disable-next-line no-console
    console.error(`${args[i]} not found, skipping`);
  }
}

if (requests.length === 0) {
  const ep = targets.map(t => t.ep.slice(1));
  /* eslint-disable */
  console.log('usage: generate-route-entries target...');
  console.log('  valid targets', ep.join(', '));
  console.log('  env vars=default: POOL=10, ITERATIONS, MIN=40, MAX=80');
  /* eslint-enable */

  process.exit(1);
}

let totalCount = 0;
requests.forEach(r => {
  totalCount += r.n;
  r.left = r.n;
  r.totalTime = 0;
});

let executedCount = 0;
const bodyMap = makeBodyMap();
const host = process.env.host || 'http://localhost:8888';

async function main() {
  const done = [];
  const xq = makeAsyncPool(asyncPoolSize);
  const start = Date.now();
  const endTime = start + timeToRun;

  while (requests.length > 0) {
    const ix = Math.floor(Math.random() * requests.length);
    const rStart = Date.now();
    const req = requests[ix];
    await xq(() => makeRequest(requests[ix])
      .then(r => {
        executedCount += 1;
        req.totalTime += Date.now() - rStart;
        return r;
      }));
    //console.log('xq', requests[ix].ep);
    // when there are no more of a given request left, it is done.
    // this needs to change for TIME_TO_RUN because we want to keep
    // going until the time is up.
    if (timeToRun) {
      if (Date.now() > endTime) {
        // should we get counts of each request?
        requests.length = 0;
      }
    } else if (--requests[ix].left <= 0) {
      const d = requests.splice(ix, 1)[0];
      done.push(d);
      d.mean = d.totalTime / d.n;
    }
  }
  await xq.done();
  const et = Date.now() - start;
  const perRequest = et / (timeToRun ? executedCount : totalCount);
  /* eslint-disable no-console */
  console.log('executed', executedCount, 'requests in', et, 'ms');
  console.log('et (ms)', et, 'ms per request', f2(perRequest));
  /* eslint-enable no-console */
  return done;
}

async function makeRequest(req) {
  const {method, ep, body} = req;
  const url = `${host}${ep}`;
  const options = {method};
  if (method === 'post') {
    options.body = bodyMap.get(body);
    options.headers = {'content-type': 'application/json'};
  }
  return fetch(url, options);
}

function makeBodyMap() {
  const b = new Map();

  for (let i = 0; i < requests.length; i++) {
    const {body} = requests[i];
    if (body && !b.get(body)) {
      const json = fs.readFileSync(`${__dirname}/../test/data/json/${body}`);
      b.set(body, json);
    }
  }
  return b;
}

//
// async pool executor
//
function makeAsyncPool(n) {
  const promises = Array(n);
  const freeslots = [...promises.keys()];
  // execute fn
  async function xq(fn) {
    if (!freeslots.length) {
      await Promise.race(promises);
    }
    const slot = freeslots.splice(0, 1)[0];
    promises[slot] = fn()
      .then(r => {
        delete promises[slot];
        freeslots.push(slot);
        return r;
      });
  }
  xq.promises = promises;
  xq.freeslots = freeslots;
  xq.done = async() => Promise.all(promises);
  return xq;
}

function f2(n) {
  return n.toFixed(2);
}


start()
  .then(main)
  .then(r => {
    if (!verbose) {
      return;
    }
    r = r.map(r => `${r.method} ${r.ep} mean: ${r.mean}`);
    // eslint-disable-next-line no-console
    console.log(r);
  })
  .then(stop);

async function start() {
  if (!server) {
    // eslint-disable-next-line no-console
    console.log('no server specified, skipping');
    return Promise.resolve();
  }
  // eslint-disable-next-line no-console
  console.log('starting server', server);

  const options = {
    env: process.env,
  };
  // base are the args for the server modules, not an endpoint.
  const url = new URL(host);
  // the protocol includes the trailing colon
  const appArg = [`${url.protocol}${url.hostname}:${url.port}`];
  const nodeargs = ['-r', '.', './test/servers/express.js', appArg];
  server = new Server(nodeargs, options);
  return server.readyPromise;
}

async function stop() {
  if (!server) {
    // eslint-disable-next-line no-console
    console.log('stopping');
    return Promise.resolve();
  }
  // eslint-disable-next-line no-console
  console.log('stopping server');
  return server.stop({type: 'signal', value: 'SIGKILL'});
}
