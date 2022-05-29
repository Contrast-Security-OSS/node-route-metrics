'use strict';

const util = require('util');

const {makeLogEntry} = require('../writer/checks');

const defaultEnv = {
  CONTRAST_DEV: true
};

const defaultOptions = {
  getBaseLogEntries: () => [],
  getEnv: (env) => [env],
  routeMetrics: './lib/index.js',
  useEmptyNodeArgs: false,
  addPatchLogEntries: true,
  basePort: 8888,
};

const patchHttp = makeLogEntry('patch', 'http');
const patchHttps = makeLogEntry('patch', 'https');
const patchContrast = makeLogEntry('patch', '@contrast/agent');

//
// makeTestGenerator() returns a generator function that returns tests
// for all combinations of server (simple, express), protocols (server:
// [http, https, both] for client: [http, https]), instrumentation (none,
// route-metrics, route-metrics + node-agent).
//
function makeTestGenerator(opts) {
  const options = Object.assign({}, defaultOptions, opts);
  const {getBaseLogEntries, getEnv, routeMetrics, basePort} = options;

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
    {desc: 'route-metrics only', args: ['-r', routeMetrics]},
    {desc: 'route-metrics + agent', args: ['-r', routeMetrics, '-r', '@contrast/agent']},
  ]};

  const logEntries = {logEntries: getBaseLogEntries()};

  const env = {env: getEnv(defaultEnv)};

  if (!options.useEmptyNodeArgs) {
    nodeArgs.nodeArgs.shift();
  }

  const combos = combinations(server, protocolPair, nodeArgs, logEntries, env);

  // return the generator that merges the result objects for each combination
  return function*() {
    for (let t of combos) {
      t = t.reduce((consol, single) => Object.assign(consol, single), {});
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
      let port = basePort;
      t.appArgs = t.loadProtos.map(p => {
        if (p === t.protocol) {
          t.base = `${p}://localhost:${port}`;
        }
        return `${p}:localhost:${port++}`;
      });
      if (!t.base) {
        throw new Error(`loadProtos ${t.loadProtos.join(', ')} doesn't contain ${t.protocol}`);
      }

      t.agentPresent = t.nodeArgs[t.nodeArgs.length - 1] === '@contrast/agent';

      if (t.logEntries && options.addPatchLogEntries) {
        // don't change the generated logEntries array
        t.logEntries = t.logEntries.slice();
        addPatchEntries(t, t.logEntries);
      }

      yield t;
    }
  };
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

//
// addPatchEntries() was part of the test generator but that didn't allow
// modifying the header check for different env var configurations. so now
// it's separate and tests that modify env vars need to manually construct
// their own expected log entries.
//
function addPatchEntries(t, logEntries) {
  // kind of funky tests but good enough. both the agent and express
  // require http.
  const expressPresent = t.server === 'express';

  // this code is specific to each combination - if the contrast agent is loaded then
  // http will be loaded before the agent completes loading. if express is loaded it
  // also loads http. finally, both the simple server and express will load http and/or
  // https depending on what protocols are being loaded.
  let httpPatchEntryAdded = false;
  let httpsPatchEntryAdded = false;
  if (t.agentPresent || expressPresent) {
    logEntries.push(patchHttp);
    httpPatchEntryAdded = true;
  }
  // as of v4.?.? the agent requires axios which requires https, so first there is
  // a patch entry for the contrast node-agent then one for https when axios requires
  // it.
  if (t.agentPresent) {
    logEntries.push(patchContrast);
    logEntries.push(patchHttps);
    httpsPatchEntryAdded = true;
  }
  t.loadProtos.forEach(lp => {
    if (lp === 'http' && !httpPatchEntryAdded) {
      logEntries.push(patchHttp);
    } else if (lp === 'https' && !httpsPatchEntryAdded) {
      logEntries.push(patchHttps);
    }
  });

  return logEntries;
}

function addTimeSeriesEntries(t, logEntries) {
  let gc = 0;
  if (t.env.CSI_RM_GARBAGE_COLLECTION) {
    logEntries.push(makeLogEntry('gc'));
    gc = 1;
  }
  let eventloop = 0;
  if (t.env.CSI_RM_EVENTLOOP) {
    logEntries.push(makeLogEntry('eventloop'));
    eventloop = 1;
  }

  return {gc, eventloop};
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
  addPatchEntries,
  addTimeSeriesEntries,
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
  function getBaseLogEntries() {
    return [[
      {some: 'kind', of: 'entry'},
      {some: 'other', kind: 'too'},
    ]];
  }
  const g = makeTestGenerator({getEnv, getBaseLogEntries, addPatchLogEntries: true});
  for (const t of g()) {
    // eslint-disable-next-line no-console
    console.log(t);
  }
}
