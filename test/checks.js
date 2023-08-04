'use strict';

const fsp = require('fs').promises;
const os = require('os');
const {expect} = require('chai');

/**
 * waitForLines() will wait for either a specific number of lines or for specified
 * lines to appear in the log file. the original implementation was for a number
 * lines but was problematic with the introduction of time-series entries (gc and
 * eventloop). if an object is passed it contains a required count for each entry
 * type (header, patch, eventloop, gc, metrics). passing an object allows the log
 * entries to appear in any order; if the order needs to be checked, it is the
 * caller's responsibility.
 *
 * @param {number|object} needed number of lines to wait for or an object as described
 * @param {object} options finer control over the waiting process
 * @return {object} {
 *   text: string,
 *   lines: string[],
 *   linesNeeded: number,
 *   foundAll: boolean,
 *   waitTime: number
 * }
 */
async function waitForLines(needed, options = {}) {
  let linesNeeded = 0;
  if (typeof needed === 'number') {
    linesNeeded = needed;
    needed = {};
  } else {
    linesNeeded = countLinesNeeded(needed);
  }
  const maxWaitTime = ('maxWaitTime' in options) ? options.maxWaitTime : 100;
  const loopWaitTime = ('loopWaitTime' in options) ? options.loopWaitTime : 10;
  const maxTries = Math.ceil(maxWaitTime / loopWaitTime);
  const start = Date.now();

  let lines;
  let text;
  let foundAll = false;
  for (let tries = 0; tries < maxTries; tries++) {
    text = await fsp.readFile('route-metrics.log', {encoding: 'utf8'});
    lines = text.split('\n').slice(0, -1);
    const logObjects = lines.map(l => JSON.parse(l));
    if (lines.length >= linesNeeded && allRequestedLines(logObjects, needed)) {
      foundAll = true;
      break;
    } else {
      await wait(loopWaitTime);
    }
  }
  return {text, lines, linesNeeded, foundAll, waitTime: Date.now() - start};
}

function countLinesNeeded(typesNeeded) {
  return Object.keys(typesNeeded).reduce((ac, key) => ac + typesNeeded[key], 0);
}

/**
 * allRequestLines() returns true if the minimum number of each required
 * type of log entry has been found. because it can be called multiple
 * times, but is called with all log entries - not just the new entries -
 * it does not modify the `needed` object; it copies it each time.
 */
function allRequestedLines(logObjects, needed) {
  const defaultsNeeded = {
    header: 1,
    patch: 0,
    gc: 0,
    eventloop: 0,
    metric: 0,
  };
  // copy
  const needCounts = Object.assign({}, defaultsNeeded, needed);
  // get rid of keys that are not needed
  for (const key in needCounts) {
    if (needCounts[key] === 0) {
      delete needCounts[key];
    }
  }

  // loop through each line of the file (it's been JSON.parsed)
  for (const line of logObjects) {
    if (line.type in needCounts) {
      needCounts[line.type] -= 1;
      // if the needCount is 0 then no more are needed.
      if (needCounts[line.type] === 0) {
        delete needCounts[line.type];
        // all needs met?
        if (Object.keys(needCounts).length === 0) {
          return true;
        }
      }
    }
  }

  return false;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

  // always set this because a test might change it.
  expected.argv = process.argv;

  if (overrides) {
    if (typeof overrides === 'function') {
      overrides = overrides();
    }

    for (const [key, obj] of Object.entries(overrides)) {
      if (!(key in expected)) {
        throw new Error(`override specifies invalid key ${key}`);
      }
      if (typeof expected[key] === 'object') {
        Object.assign(expected[key], obj);
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
  expect(entry).property('heapUsedAvg').a('number');
  expect(entry).property('externalAvg').a('number');
}

/**
 * if/when this is tested.
 */
function checkUnknownConfigItems(option) {
  // add check for specific bad option
}

/**
 * The loosely defined checking functions. waitForLines() should probably
 * be moved out of here.
 */
const checks = {
  waitForLines,
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
  validator.show = () => {return {type, args: [...args]}};
  return {type, validator};
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
    // http is required first because, even though the node agent is loaded first,
    // it requires http before it completes loading, and patch events are only emitted
    // once patching is completed.
    //
    // also, as of v4.?.? the agent also requires axios, which requires https, so next
    // there is a patch entry for the contrast node-agent then one for https when axios
    // eventually requires it.
    patchNames = ['http', 'https', t.agentPresent];
    checkers.push(makeLogEntryChecker('patch', patchNames));
    checkers.push(makeLogEntryChecker('patch', patchNames));
    checkers.push(makeLogEntryChecker('patch', patchNames));
  } else if (t.agentPresent === '@contrast/rasp-v3') {
    //
    // rasp-v3 does not require either http or https, so it's the first patch entry.
    //
    patchNames.push(t.agentPresent);
    checkers.push(makeLogEntryChecker('patch', patchNames));

    if (t.loadProtos.includes('http') || expressPresent) {
      patchNames.push('http');
      checkers.push(makeLogEntryChecker('patch', patchNames));
    }
    if (t.loadProtos.includes('https')) {
      patchNames.push('https');
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
  makePatchEntryCheckers,
  makeMetricsChecker,
  makeTimeSeriesCheckers,
};
