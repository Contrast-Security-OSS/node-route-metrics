#!/usr/bin/env node
'use strict';

const fsp = require('fs').promises;
const path = require('path');
const util = require('util');
const semver = require('semver');

const Server = require('../test/servers/server');
const {AGENTS} = require('../lib/patcher');

const defaultEnv = {
  CONTRAST_DEV: true,
  CSI_EXPOSE_CORE: true,
};

let loader = '--import';
let routeMetrics = './lib/index-esm.mjs';
if (semver.satisfies(process.versions.node, '<=18.19.0')) {
  loader = '-r';
  routeMetrics = './lib/index-cjs.cjs';
}

const defaultOptions = {
  getEnv: (env) => [env],
  routeMetrics,
  useEmptyNodeArgs: false,
  addPatchLogEntries: true,
  basePort: 0,
};

//
// makeTestGenerator() returns a generator function that returns tests
// for all combinations of server (simple, express), protocols (server:
// [http, https, both] for client: [http, https]), instrumentation (none,
// route-metrics, route-metrics + node-agent).
//
function makeTestGenerator(opts) {
  const options = Object.assign({}, defaultOptions, opts);
  const {getEnv, routeMetrics, basePort} = options;

  const server = {server: ['simple', 'express']};

  // load: [load these], fetch: access using this
  const protocolPair = {protocolPair: [
    {load: ['http'], fetch: 'http'},
    {load: ['https'], fetch: 'https'},
    {load: ['http', 'https'], fetch: 'http'},
    {load: ['http', 'https'], fetch: 'https'},
  ]};

  const nodeArgs = {nodeArgs: [
    {desc: 'nothing', args: []},
    {desc: 'route-metrics only', args: [loader, routeMetrics]},
    {desc: 'route-metrics + agent', args: [loader, routeMetrics, loader, '@contrast/agent']},
    //{desc: 'route-metrics + node mono', args: ['-r', routeMetrics, '-r', '@contrast/protect-agent']},
    //{desc: 'route-metrics + rasp-v3', args: ['-r', routeMetrics, '-r', '@contrast/rasp-v3']},
  ]};

  const env = {env: getEnv(defaultEnv)};

  if (!options.useEmptyNodeArgs) {
    nodeArgs.nodeArgs.shift();
  }

  const combos = combinations(server, protocolPair, nodeArgs, env);

  // return the generator that merges the result objects for each combination
  return function*() {
    for (const t of combos) {
      yield new Test(t, {basePort});
    }
  };
}

class Test {
  constructor(testDefinition, {basePort}) {
    // save port before reducing the testDefinition.
    const port = basePort;
    const t = testDefinition.reduce((consol, single) => Object.assign(consol, single), {});
    // rearrange and augment the test
    t.protocol = t.protocolPair.fetch;
    t.loadProtos = t.protocolPair.load;
    t.nodeArgsDesc = t.nodeArgs.desc;
    t.desc = `${t.server} with ${t.nodeArgs.desc} via ${t.protocol} (${t.loadProtos.join(', ')})`;
    const nonDefaultEnv = removeDefaultEnv(t.env);
    if (Object.keys(nonDefaultEnv).length >= 1) {
      t.desc = `${t.desc} (${util.format(nonDefaultEnv)})`;
    }
    t.nodeArgs = t.nodeArgs.args;

    // make the arguments for the server app and define the base url to access
    // the server app.
    t.appArgs = t.loadProtos.map(p => {
      if (p === t.protocol) {
        t.base = `${p}://localhost:${port}`;
      }
      const port2 = port === 0 ? port : port + 1;
      return `${p}:localhost:${port2}`;
    });
    if (!t.base) {
      throw new Error(`loadProtos ${t.loadProtos.join(', ')} doesn't contain ${t.protocol}`);
    }

    const ix = AGENTS.indexOf(t.nodeArgs[t.nodeArgs.length - 1]);
    t.agentPresent = ix >= 0 && AGENTS[ix];

    //
    Object.assign(this, t);
  }

  async setup(options) {
    try {
      await fsp.unlink('route-metrics.log');
    } catch (e) {
      // ignore
    }

    const {server, nodeArgs, appArgs, base} = this;

    const absoluteServerPath = path.resolve(`./test/servers/${server}`);
    const nodeargs = [...nodeArgs, absoluteServerPath, ...appArgs];
    const env = Object.assign({}, process.env, this.env);
    const testServer = new Server(nodeargs, {env});
    // make argv match what the server will see.
    process.argv = [process.argv[0], absoluteServerPath, ...appArgs];
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
    const ports = await testServer.readyPromise;

    // wrap the http verbs with the correct port for the test (base specifies
    // the protocol and port, but the port is dynamically assigned, so it needs
    // to be updated).
    wrapVerbs(testServer, base, ports);

    return testServer;
  }
}

function removeDefaultEnv(env) {
  const e = Object.assign({}, env);
  for (const key in defaultEnv) {
    if (env[key] === defaultEnv[key]) {
      delete e[key];
    }
  }
  return e;
}

function wrapVerbs(testServer, base, ports) {
  const parts = base.split(':');
  const protocol = parts[0];
  const host = parts[1];
  const port = ports[protocol];
  const baseUrl = `${protocol}://${host}:${port}`;

  const originalPost = testServer.post;
  const originalGet = testServer.get;

  testServer.post = function(path, ...args) {
    return originalPost.call(testServer, `${baseUrl}${path}`, ...args);
  };
  testServer.get = function(path, ...args) {
    return originalGet.call(testServer, `${baseUrl}${path}`, ...args);
  };
}

//
// tagged combinations generator. it takes any number of arguments of the form:
// {key1: [value1, value2]}, {keyA: [valueA, valueB]} and returns an array of
// the combinations:
// [
//   [{key1: value1}, {keyA: valueA}],
//   [{key1: value2}, {keyA: valueA}],
//   [{key1: value1}, {keyA: valueB}],
//   [{key1: value2}, {keyA: valueB}],
// ]
//
// the number of combinations generated is equal to the multiplication of the
// lengths of each array supplied as an argument. arrays of zero length are skipped.
//
function* combinations(head, ...tail) {
  const key = Object.keys(head)[0];
  const values = head[key];
  const remainder = tail.length ? combinations(...tail) : [[]];
  // skip empty arrays so they don't result in zero combinations.
  if (values.length) {
    for (const r of remainder) {
      for (const h of values) {
        yield [{[key]: h}, ...r];
      }
    }
  } else {
    for (const r of remainder) {
      yield [...r];
    }
  }
}

module.exports = {
  makeTestGenerator,
  combinations,
};

//
// this is mostly here as a reference. execute this file and the output
// shows what is generated.
//
if (!module.parent) {
  const combos = combinations({bruce: [1, 2]}, {wenxin: [3, 4]}, {grace: [5, 6]});
  for (const c of combos) {
    // eslint-disable-next-line no-console
    console.log(c.reduce((consol, single) => Object.assign(consol, single), {}));
  }
  function getEnv() {return [{bruce: 'wenxin'}]}

  const g = makeTestGenerator({getEnv, addPatchLogEntries: true});
  for (const t of g()) {
    // eslint-disable-next-line no-console
    console.log(t);
  }
}
