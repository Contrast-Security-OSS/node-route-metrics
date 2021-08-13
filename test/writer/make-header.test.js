'use strict';

const {checks} = require('./checks');

const makeHeader = require('../../lib/writer/make-header');
const pdj = require('../../package.json');
const serversPdj = require('../servers/package.json');
const config = {LOG_FILE: 'route-metrics.log', OUTPUT_CONFIG: null};

describe('make-header', function() {
  const argv = process.argv.slice();
  afterEach(function() {
    process.argv = argv;
  });

  it('fetches good information', function() {
    const version = '0.0.0';
    const {header} = makeHeader(version, config);
    checks.header(header, pdj, {version});
  });

  it('find package.json when node runs a directory', function() {
    process.argv[1] = '.';
    const version = '9.9.9';
    const {header} = makeHeader(version, config);
    checks.header(header, pdj, {version});
  });

  it('find package.json when node runs a file', function() {
    process.argv[1] = 'index.js';
    const version = '8.8.8';
    const {header} = makeHeader(version, config);
    checks.header(header, pdj, {version});
  });

  it('finds first package.json when node runs a directory', function() {
    process.argv[1] = 'test/servers';
    const version = '6.6.6';
    const {header} = makeHeader(version, config);
    checks.header(header, version, {version, package_json: serversPdj});
  });

  it('finds first package.json when node runs a file', function() {
    process.argv[1] = 'test/servers/simple';
    const version = '6.6.6';
    const {header} = makeHeader(version, config);
    checks.header(header, version, {version, package_json: serversPdj});
  });

  it('skip package.json when it doesn\'t exist', function() {
    process.argv[1] = '/';
    const version = '7.7.7';
    const {header} = makeHeader(version, config);
    checks.header(header, version, {version, package_json: undefined});
  });
});
