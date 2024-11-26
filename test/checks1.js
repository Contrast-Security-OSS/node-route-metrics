'use strict';

const os = require('os');
const util = require('util');

const semver = require('semver');
const {expect} = require('chai');

const nodeIsGreaterThanV20 = semver.satisfies(process.version, '>=20.0.0');
const nodeIsLessThanV18dot19 = semver.satisfies(process.version, '<18.19.0');

/**
 * checkHeader() checks to see if the header is correct. It duplicates much of
 * the code for writing the header.
 */
const _expected = {
  version: '1.0.0',
  argv: process.argv,
  node_version: process.version,
  os: {},
  package_json: {}
};

const _os = {
  arch: os.arch(),
  hostname: os.hostname(),
  freemem: 1,
  totalmem: os.totalmem(),
  getPriority: os.getPriority(),
  loadavg: [],
  uptime: 1,
  type: os.type(),
  platform: os.platform(),
  release: os.release(),
  version: os.version(),
  userInfo: os.userInfo(),
  homedir: os.homedir(),
  tmpdir: os.tmpdir(),
  endianness: os.endianness(),
};

function checkHeader(header, pdj, overrides) {
  const expected = Object.assign({}, _expected, {os: _os}, {package_json: pdj});
  // set some things that change quickly to just match
  const {freemem, loadavg, uptime} = header.os;
  expect(freemem).a('number');
  expected.os.freemem = freemem;
  expect(loadavg).an('array');
  expected.os.loadavg = loadavg;
  expect(uptime).a('number');
  expected.os.uptime = uptime;

  const cpus = os.cpus();
  expected.os.cpus = cpus.length;
  expected.os.cpuModel = cpus[0].model;

  const ni = os.networkInterfaces();
  expected.os.networkInterfaces = Object.create(null);
  for (const iface in ni) {
    // extract minimal information
    expected.os.networkInterfaces[iface] = ni[iface].map((ni) => {
      return {
        address: ni.address,
        netmask: ni.netmask
      };
    });
  }

  expected.config = {
    LOG_FILE: 'route-metrics.log',
    OUTPUT_CONFIG: '',
    EVENTLOOP: false,
    EVENTLOOP_RESOLUTION: 20,
    GARBAGE_COLLECTION: false,
  };

  // always set these because a test might change them.
  expected.argv = process.argv;
  expected.execArgv = process.execArgv;

  if (overrides) {
    if (typeof overrides === 'function') {
      overrides = overrides();
    }

    for (const [key, obj] of Object.entries(overrides)) {
      if (!(key in expected)) {
        throw new Error(`override specifies invalid key ${key}`);
      }
      if (typeof expected[key] === 'object') {
        if (!Array.isArray(expected[key])) {
          Object.assign(expected[key], obj);
        } else {
          expected[key] = obj;
        }
      } else {
        expected[key] = obj;
      }
    }
  }

  expect(header).eql(expected);
}

/**
 * checkPatch() verifies a patch entry. This approach does not allow
 * multiple entries with the same name, but that shouldn't happen. It's
 * done this way because the various different agents and versions result
 * in different sequences of patches. For example, prior to node 16.19.1,
 * with @contrast/agent, the http patch was first because patch entries
 * were only made after the module was finished loading. But with 16.19.1,
 * the http patch is second because the we cannot detect the actual loading
 * of @contrast/agent; we only detect it by noting that it's required on
 * the command line and at least one @contrast package is being loaded (all
 * contrast agents require @contrast/something).
 */
function checkPatch(entry, patchNames) {
  expect(entry).property('name').oneOf(patchNames);
  patchNames.splice(patchNames.indexOf(entry.name), 1);
}

/**
 * keys that must be present in a metrics entry.
 */
const metricsKeys = {
  method: ['POST', 'GET'],
  host: {type: 'string'},
  port: {type: 'number'},
  url: {type: 'string'},
  start: {type: 'number'},
  et: {type: 'number'},
  statusCode: {type: 'number'},
};

/**
 * checkMetrics() is an abbreviated metrics-entry checker. use makeMetricsChecker()
 * for more specific checking.
 */
function checkMetrics(entry, overrides) {
  for (const key in metricsKeys) {
    if (Array.isArray(metricsKeys[key])) {
      expect(entry).property(key).oneOf(metricsKeys[key]);
    } else {
      expect(entry).property(key).a(metricsKeys[key].type);
    }
  }
}

/**
 * checkGarbageCollection() verifies that a gc entry has the correct properties.
 */
function checkGarbageCollection(entry, overrides) {
  expect(entry).property('count').a('number');
  expect(entry).property('totalTime').a('number');
}

/**
 * checkEventLoop() verifies that an eventloop entry has the correct percentiles.
 */
function checkEventloop(entry, overrides) {
  if (typeof overrides === 'function') {
    overrides = overrides();
  }
  // overrides?
  for (const percentile of [50, 75, 90, 95, 99]) {
    expect(entry[percentile]).a('number');
  }
}

function checkProc(entry, overrides) {
  expect(entry).property('cpuUserAvg').a('number');
  expect(entry).property('cpuSystemAvg').a('number');
  expect(entry).property('rss').a('number');
  expect(entry).property('heapTotal').a('number');
  expect(entry).property('heapUsed').a('number');
  expect(entry).property('external').a('number');
}

/**
 * if/when this is tested.
 */
function checkUnknownConfigItems(option) {
  // add check for specific bad option
}

/**
 * The loosely defined checking functions.
 */
const checks = {
  header: checkHeader,
  patch: checkPatch,
  route: checkMetrics,
  gc: checkGarbageCollection,
  eventloop: checkEventloop,
  proc: checkProc,
  'unknown-config-items': checkUnknownConfigItems,
};

/**
 * makeLogEntryChecker() defines a validator function that uses the `checks` map
 * to choose the correct checker for the type.
 */
function makeLogEntryChecker(type, ...args) {
  const validator = (entry) => checks[type](entry, ...args);
  // show is used for debugging - it shows the type and arguments of the
  // checker.
  validator.show = () => {return {type, args: [...args]}};
  return {type, validator};
}

/**
 * make a group of validators that allow the entries to be in any order.
 * this is similar to the makePatchEntryCheckers(), which can handle the
 * patches in any order, but is generalized.
 *
 * as it turns out, this needs to replace makePatchEntryCheckers() because
 * patches are not always loaded at startup, especially when the agent is
 * loaded using --import, because ESM modules are loaded asynchronously.
 */
function makeUnorderedLogEntryChecker(checksToMake) {
  const remainingValidators = new Set();
  const validators = {};
  for (const {type, vArgs: args = []} of checksToMake) {
    if (!(type in validators)) {
      validators[type] = [];
    }
    const checker = makeLogEntryChecker(type, ...args);
    validators[type].push(checker);
    remainingValidators.add(type);
  }

  function validator(entry) {
    const type = entry.type;
    if (!(type in validators)) {
      throw new Error(`unexpected type: ${util.format(entry)}`);
    }
    entry = entry.entry;
    const checkers = validators[type];
    // for now, they have to be in order. that might need to change. if
    // it does this will need to call a non-exception checker (or maybe
    // just catch the exception).
    if (checkers.length) {
      checkers[0].validator(entry);
      checkers.shift();
    }
    if (checkers.length === 0) {
      // no more checkers for this type
      remainingValidators.delete(type);
      if (remainingValidators.size === 0) {
        // no more checkers for any type
        return true;
      }
    }
  }
  validator.show = () => {return {type: 'unordered', checksToMake}};

  const unorderedValidators = [];
  for (let i = 0; i < checksToMake.length; i++) {
    unorderedValidators.push({validator, type: Object.keys(validators)});
  }
  return unorderedValidators;
}

/**
 * predefined checkers for the three files we patch.
 */

//
// makePatchEntryCheckers() was part of the test generator but that didn't allow
// modifying the header check for different env var configurations. so now
// it's separate and tests that modify env vars need to manually construct
// their own expected log entries.
//
function makePatchEntryCheckers(t) {
  const checkers = [];
  let patchNames = [];

  // both the node-agent and express require http, so it will be present
  const expressPresent = t.server === 'express';

  // the expected sequence of patches is specific to each combination of agent and
  // express. @contrast/protect-agent needs to be added. N.B. as of node 16.19.1,
  // the agent cannot be detected by route-metrics, because it is being loaded via
  // the '-r' or '--request' command line opion. so it is being detected by looking
  // at process.execArgv when the first module in the @contrast scope is loaded.
  if (t.agentPresent === '@contrast/agent') {
    //
    // http and https (since the agent started using axios) are always required
    // by the node agent even if the server doesn't use https.
    //
    patchNames = ['http'];
    // for some reason we do not see get a chance to patch https when the agent
    // is loaded by node v18.19.0 up to 20.0.0. i think this is because the
    // tests run with route-metrics and the agent loaded using --import. there
    // is no fix for this short of updating route-metrics with esm support.
    //
    // perversely, even if https is not specified, it gets loaded by axios
    // which @contrast/agent uses, so it's always present when the agent is.
    if (!t.loadProtos.includes('https')) {
      if (nodeIsGreaterThanV20 || nodeIsLessThanV18dot19) {
        patchNames.push('https');
      }
    } else {
      patchNames.push('https');
    }

    patchNames.push(t.agentPresent);
    for (let i = 0; i < patchNames.length; i++) {
      checkers.push(makeLogEntryChecker('patch', patchNames));
    }
  } else if (!t.agentPresent) {
    //
    // no agent, so http and https are the only patch entries.
    //
    if (t.loadProtos.includes('http') || expressPresent) {
      patchNames.push('http');
      checkers.push(makeLogEntryChecker('patch', patchNames));
    }
    if (t.loadProtos.includes('https')) {
      patchNames.push('https');
      checkers.push(makeLogEntryChecker('patch', patchNames));
    }
  } else {
    throw new Error(`unexpected agentPresent value: ${t.agentPresent}`);
  }
  // hack to make the patchNames array visible. used while making the test
  // handle varied-order log entries.
  checkers.patchNames = patchNames;

  return checkers;
}

function makeTimeSeriesCheckers(t) {
  let gc = 0;
  const checkers = [];
  if (t.env.CSI_RM_GARBAGE_COLLECTION) {
    checkers.push(makeLogEntryChecker('gc'));
    gc = 1;
  }
  let eventloop = 0;
  if (t.env.CSI_RM_EVENTLOOP) {
    checkers.push(makeLogEntryChecker('eventloop'));
    eventloop = 1;
  }
  checkers.push(makeLogEntryChecker('proc'));

  return {checkers, gc, eventloop, proc: 1};
}

function makeMetricsChecker(method, pathEnd) {
  return {method, pathEnd, validator: (entry) => {
    expect(entry.method).equal(method);
    expect(entry.url.endsWith(pathEnd)).equal(true, `expected url to end with ${pathEnd}`);
    checks.metrics(entry);
  }};
}

module.exports = {
  checks,
  makeLogEntryChecker,
  makeUnorderedLogEntryChecker,
  makePatchEntryCheckers,
  makeMetricsChecker,
  makeTimeSeriesCheckers,
};
