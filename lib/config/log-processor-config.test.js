'use strict';

const {expect} = require('chai');
const getConfig = require('./log-processor-config').get;

const csvPath = require.resolve('../log-processor/reporters/csv.js');
const jsonPath = require.resolve('../log-processor/reporters/json.js');

const templateRelative = 'test/data/template.js';

const prefix = 'CSI_RM_';
const defaultConfig = {
  REPORTER: csvPath,
  OUTPUT: '1',
  TEMPLATE: '',
  MICROSECONDS: false,
};


describe('log-processor-config tests', function() {
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

  it('converts boolean options to boolean', function() {
    process.env[`${prefix}MICROSECONDS`] = true;
    const modified = {
      MICROSECONDS: true,
    };
    const {config, errors} = getConfig();
    const expected = Object.assign({}, defaultConfig, modified);
    expect(config).eql(expected);
    checkErrors(errors);
  });

  it('allow setting valid options', function() {
    process.env[`${prefix}REPORTER`] = 'json';
    process.env[`${prefix}OUTPUT`] = 'not-tty.output';
    process.env[`${prefix}MICROSECONDS`] = true;
    const modified = {
      REPORTER: jsonPath,
      OUTPUT: 'not-tty.output',
      MICROSECONDS: true,
    };
    const {config, errors} = getConfig();
    const expected = Object.assign({}, defaultConfig, modified);
    expect(config).eql(expected);
    checkErrors(errors);
  });

  it('allow setting a valid template', function() {
    process.env[`${prefix}TEMPLATE`] = templateRelative;
    const {config, errors} = getConfig();
    const expected = Object.assign({}, defaultConfig);

    // perform some sleight-of-hand here. the template, if it is valid,
    // becomes the parsed/validated template.
    const template = config.TEMPLATE;
    delete config.TEMPLATE;
    delete expected.TEMPLATE;

    expect(config).eql(expected);
    expect(template).an('object').keys(['labels', 'options', 'routes', 'version']);
    checkErrors(errors);
  });

  it('report unknown options when good options are present', function() {
    process.env[`${prefix}REPORTER`] = 'json';
    process.env[`${prefix}MY_CAT`] = 'yinyin';
    const modified = {REPORTER: jsonPath};
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
    process.env[`${prefix}MICROSECONDS`] = 't';
    const {config, errors} = getConfig();
    expect(config).eql(defaultConfig);
    checkErrors(errors, {invalid: [`${prefix}MICROSECONDS must be true or false, not t`]});
  });

  it('does not consider agent options as unknown to agent', function() {
    const el = `${prefix}EVENTLOOP`;
    let previous;
    if (el in process.env) {
      previous = process.env[el];
    }
    process.env[el] = true;
    const {config, errors} = getConfig();
    // cannot set it to previous if previous === undefined, as it will then
    // be set to 'undefined'.
    if (!previous) {
      delete process.env[el];
    }
    expect(config).eql(defaultConfig);
    checkErrors(errors);
  });

  it('returns the right value in errors.invalid when a non-existent template is passed', function() {
    process.env.CSI_RM_TEMPLATE = 'xyxxy.x';
    const {config, errors} =  getConfig();
    expect(errors.invalid[0]).contains('CSI_RM_TEMPLATE=xyxxy.x').contains('Template Error: Cannot find module');
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
