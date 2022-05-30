'use strict';

const fsp = require('fs').promises;
const os = require('os');
const {expect} = require('chai');

async function waitForLinesAndCheck(expected, options = {}) {
  const needed = ('needed' in options) ? options.needed : expected.length;
  const {lines: rawLines} = await waitForLines(needed, options);
  const lines = rawLines.map(JSON.parse);
  expect(lines).exist;
  expect(lines.length).gte(needed, 'not enough lines');
  for (let i = 0; i < expected.length; i++) {
    const {validator} = expected[i];
    expect(lines).property(i).exist;
    expect(lines[i]).property('type').equal(expected[i].type);
    validator(lines[i].entry);
  }
}

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
 * @return {object} {text: string, lines: string[], foundAll: boolean, waitTime: number}
 */
async function waitForLines(needed, options = {}) {
  let linesNeeded = 0;
  if (typeof needed === 'number') {
    linesNeeded = needed;
    needed = {};
  }
  const totalWaitTime = ('totalWaitTime' in options) ? options.totalWaitTime : 100;
  const loopWaitTime = ('loopWaitTime' in options) ? options.loopWaitTime : 10;
  const maxTries = Math.ceil(totalWaitTime / loopWaitTime);
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
  return {text, lines, foundAll, waitTime: Date.now() - start};
}

function allRequestedLines(logObjects, needed) {
  const defaultsNeeded = {
    header: 1,
    patch: 0,
    gc: 0,
    eventloop: 0,
    metric: 0,
  };
  const needCounts = Object.assign({}, defaultsNeeded, needed);
  for (const key in needCounts) {
    if (needCounts[key] === 0) {
      delete needCounts[key];
    }
  }

  for (const line of logObjects) {
    if (line.type in needCounts) {
      needCounts[line.type] -= 1;
      if (needCounts[line.type] === 0) {
        delete needCounts[line.type];
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

function checkPatch(entry, name, overrides) {
  expect(entry).property('name').equal(name);
}

const metricsKeys = {
  method: ['POST', 'GET'],
  host: {type: 'string'},
  port: {type: 'number'},
  url: {type: 'string'},
  start: {type: 'number'},
  et: {type: 'number'},
  statusCode: {type: 'number'},
};

function checkMetrics(entry, overrides) {
  for (const key in metricsKeys) {
    if (Array.isArray(metricsKeys[key])) {
      expect(entry).property(key).oneOf(metricsKeys[key]);
    } else {
      expect(entry).property(key).a(metricsKeys[key].type);
    }
  }
}

function checkGarbageCollection(entry, overrides) {
  expect(entry).property('count').a('number');
  expect(entry).property('totalTime').a('number');
}

function checkEventloop(entry, overrides) {
  if (typeof overrides === 'function') {
    overrides = overrides();
  }
  // overrides?
  for (const percentile of [50, 75, 90, 95, 99]) {
    expect(entry[percentile]).a('number');
  }

}

function checkUnknownConfigItems(option) {
  // add check for specific bad option
}

const checks = {
  waitForLines,
  waitForLinesAndCheck,
  header: checkHeader,
  patch: checkPatch,
  metrics: checkMetrics,
  gc: checkGarbageCollection,
  eventloop: checkEventloop,
  'unknown-config-items': checkUnknownConfigItems,
};

function makeLogEntry(type, ...args) {
  return {type, validator: (entry) => checks[type](entry, ...args)};
}

function makeMetricsLogEntry(method, pathEnd) {
  return {method, pathEnd, validator: (entry) => {
    expect(entry.method).equal(method);
    expect(entry.url.endsWith(pathEnd)).equal(true, `expected url to end with ${pathEnd}`);
    checks.metrics(entry);
  }};
}

module.exports = {checks, makeLogEntry, makeMetricsLogEntry};
