'use strict';

const assert = require('node:assert');
const path = require('node:path');

const HeaderChecker = require('../../test-integration/checks/header');

const makeHeader = require('./make-header');
const pdj = require('../../package.json');
const app_dir = path.resolve(__dirname, '../..');
const serversPdj = require('../../test/servers/package.json');
const servers_app_dir = path.resolve(__dirname, '../../test/servers');
const config = {
  LOG_FILE: 'route-metrics.log',
  OUTPUT_CONFIG: '',
  EVENTLOOP: false,
  EVENTLOOP_RESOLUTION: 20,
  GARBAGE_COLLECTION: false,
};

// on windows, mocha's bin is under the mocha directory, not node_modules. as
// a result the resolution logic will find mocha's package.json, not the one
// the test should really find. this probably should always set the path.
const prevArgv = process.argv.slice();
if (process.argv[1].endsWith('mocha')) {
  process.argv[1] = path.resolve(process.cwd());
}

describe('make-header', function() {
  const argv = process.argv.slice();
  afterEach(function() {
    process.argv = argv;
  });
  after(function() {
    process.argv = prevArgv;
  });

  it('fetches good information', function() {
    const version = '0.0.0';
    const checker = new HeaderChecker(pdj, {version, app_dir});

    const {header, errors} = makeHeader(version, config);
    checker.check(header, {index: 0});

    assert(Array.isArray(errors), 'expected errors to be an array');
    assert.equal(errors.length, 0, 'expected no errors');
  });

  it('find package.json when node runs a directory', function() {
    process.argv[1] = '.';
    const version = '9.9.9';
    const checker = new HeaderChecker(pdj, {version, app_dir});

    const {header, errors} = makeHeader(version, config);
    checker.check(header, {index: 0});

    assert(Array.isArray(errors), 'expected errors to be an array');
    assert.equal(errors.length, 0, 'expected no errors');
  });

  it('find package.json when node runs a file', function() {
    process.argv[1] = 'index.js';
    const version = '8.8.8';
    const checker = new HeaderChecker(pdj, {version, app_dir});

    const {header, errors} = makeHeader(version, config);
    checker.check(header, {index: 0});

    assert(Array.isArray(errors), 'expected errors to be an array');
    assert.equal(errors.length, 0, 'expected no errors');
  });

  it('finds first package.json when node runs a directory', function() {
    process.argv[1] = 'test/servers';
    const version = '6.6.6';
    const checker = new HeaderChecker(serversPdj, {version, app_dir: servers_app_dir});

    const {header, errors} = makeHeader(version, config);
    checker.check(header, {index: 0});

    assert(Array.isArray(errors), 'expected errors to be an array');
    assert.equal(errors.length, 0, 'expected no errors');
  });

  it('finds first package.json when node runs a file', function() {
    process.argv[1] = 'test/servers/simple';
    const version = '6.6.6';
    const checker = new HeaderChecker(serversPdj, {version, app_dir: servers_app_dir});

    const {header, errors} = makeHeader(version, config);
    checker.check(header, {index: 0});

    assert(Array.isArray(errors), 'expected errors to be an array');
    assert.equal(errors.length, 0, 'expected no errors');
  });

  it('skip package.json when it doesn\'t exist', function() {
    process.argv[1] = '/';
    const version = '7.7.7';
    const pdj = undefined;
    const checker = new HeaderChecker(pdj, {version});

    const {header, errors} = makeHeader(version, config);
    checker.check(header, {index: 0});

    assert(Array.isArray(errors), 'expected errors to be an array');
    assert.deepEqual(errors, ['cannot find package.json for application: /']);
  });
});
