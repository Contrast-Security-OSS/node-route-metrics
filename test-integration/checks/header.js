'use strict';

const os = require('os');
const expect = require('chai').expect;

const BaseChecker = require('./_base');

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

class HeaderChecker extends BaseChecker {
  constructor(pdj, overrides = {}) {
    super({type: 'header', requiredEntries: 1});
    this.pdj = pdj;
    this.overrides = overrides;
  }

  check(entry, context) {
    expect(context.index).equal(0, `header must be first entry, not index ${context.index}`);
    const expected = Object.assign({}, _expected, {os: _os}, {package_json: this.pdj, app_dir: '.'});
    // set some things that change quickly to just match
    const {freemem, loadavg, uptime} = entry.os;
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

    if (this.overrides) {
      let overrides = this.overrides;
      if (typeof overrides === 'function') {
        overrides = this.overrides();
      }

      for (const [key, obj] of Object.entries(overrides)) {
        if (!(key in expected)) {
          throw new Error(`override specifies invalid key "${key}"`);
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

    expect(entry).eql(expected);
  }
}

module.exports = HeaderChecker;
