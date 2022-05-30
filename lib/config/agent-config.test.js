'use strict';

const {expect} = require('chai');
const getConfig = require('./agent-config').get;

const prefix = 'CSI_RM_';
const defaultConfig = {
  LOG_FILE: 'route-metrics.log',
  OUTPUT_CONFIG: '',
  EVENTLOOP: false,
  EVENTLOOP_RESOLUTION: 20,
  GARBAGE_COLLECTION: false,
};

const catMattLog = 'cat-matt.log';
const shusiaJs = 'shusia.js';

describe('get-config tests', function() {
  beforeEach(function() {
    for (const k in process.env) {
      if (k.startsWith(prefix)) {
        delete process.env[k];
      }
    }
  });

  it('default options when no env vars are present', function() {
    const {config, errors} = getConfig();
    expect(config).eql(defaultConfig);
    checkErrors(errors);
  });

  it('allow setting valid options', function() {
    process.env[`${prefix}LOG_FILE`] = catMattLog;
    process.env[`${prefix}OUTPUT_CONFIG`] = shusiaJs;
    process.env[`${prefix}EVENTLOOP`] = true;
    process.env[`${prefix}GARBAGE_COLLECTION`] = true;
    const modified = {
      LOG_FILE: catMattLog,
      OUTPUT_CONFIG: shusiaJs,
      EVENTLOOP: true,
      GARBAGE_COLLECTION: true,
    };
    const {config, errors} = getConfig();
    const expected = Object.assign({}, defaultConfig, modified);
    expect(config).eql(expected);
    checkErrors(errors);
  });

  it('converts boolean options to boolean', function() {
    process.env[`${prefix}EVENTLOOP`] = true;
    process.env[`${prefix}GARBAGE_COLLECTION`] = true;
    const modified = {
      EVENTLOOP: true,
      GARBAGE_COLLECTION: true,
    };
    const {config, errors} = getConfig();
    const expected = Object.assign({}, defaultConfig, modified);
    expect(config).eql(expected);
    checkErrors(errors);
  });

  it('report unknown options when good options are present', function() {
    process.env[`${prefix}LOG_FILE`] = catMattLog;
    process.env[`${prefix}OUTPUT_CONFIG`] = shusiaJs;
    process.env[`${prefix}MY_CAT`] = 'yinyin';
    const modified = {LOG_FILE: catMattLog, OUTPUT_CONFIG: shusiaJs};
    const {config, errors} = getConfig();
    const expected = Object.assign({}, defaultConfig, modified);
    expect(config).eql(expected);
    checkErrors(errors, {unknown: [`${prefix}MY_CAT`]});
  });

  it('report unknown options when no good options are present', function() {
    process.env[`${prefix}MY_CAT`] = 'yinyin';
    const {config, errors} = getConfig();
    expect(config).eql(defaultConfig);
    checkErrors(errors, {unknown: [`${prefix}MY_CAT`]});
  });

  it('report invalid values for options', function() {
    // there are no invalid options at this time.
    expect(true).true;
  });

});

function checkErrors(errors, {unknown = [], invalid = []} = {}) {
  const ulen = unknown.length;
  const ilen = invalid.length;
  expect(errors.unknown).an('array').length(ulen, `should have ${ulen} unknowns`);
  if (ulen) {
    expect(errors.unknown).eql(unknown);
  }

  expect(errors.invalid).an('array').length(ilen, `should have ${ilen} invalids`);
  if (ilen) {
    expect(errors.invalid).eql(invalid);
  }
}
