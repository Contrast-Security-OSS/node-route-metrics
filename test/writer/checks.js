'use strict';

const fsp = require('fs').promises;
const os = require('os');
const {expect} = require('chai');

async function waitForLinesAndCheck(expected, needed = expected.length) {
  let lines;
  for (let tries = 10; tries > 0; tries--) {
    const text = await fsp.readFile('route-metrics.log', {encoding: 'utf8'});
    lines = text.split('\n').slice(0, -1);
    if (lines.length >= needed) {
      // check results against expected
      lines = lines.map(JSON.parse);
      for (let i = 0; i < expected.length; i++) {
        const {validator} = expected[i];
        expect(lines).property(i).exist;
        expect(lines[i]).property('type').equal(expected[i].type);
        validator(lines[i].entry);
      }
    } else {
      await wait(10);
    }
  }
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
    OUTPUT_CONFIG: null,
    EVENTLOOP: false,
    EVENTLOOP_RESOLUTION: 20,
    GARBAGE_COLLECTION: false,
  };

  // always set this as a test might change it.
  expected.argv = process.argv;

  if (overrides) {
    Object.assign(expected, overrides);
  }

  expect(header).eql(expected);
}

function checkPatch(patch, name, overrides) {
  expect(patch).property('name').equal(name);
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

function checkMetrics(metrics, overrides) {
  for (const key in metricsKeys) {
    if (Array.isArray(metricsKeys[key])) {
      expect(metrics).property(key).oneOf(metricsKeys[key]);
    } else {
      expect(metrics).property(key).a(metricsKeys[key].type);
    }
  }
}

function checkUnknownConfigItems(option) {
  // add check for specific bad option
}

const checks = {
  waitForLinesAndCheck,
  header: checkHeader,
  patch: checkPatch,
  metrics: checkMetrics,
  'unknown-config-items': checkUnknownConfigItems,
};

function makeLogEntry(type, ...args) {
  return {type, validator: (entry) => checks[type](entry, ...args)};
}

module.exports = {checks, makeLogEntry};
