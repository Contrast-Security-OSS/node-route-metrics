'use strict';

const semver = require('semver');
const {expect} = require('chai');
const Require = module.constructor.prototype.require;

const {patcher, emitter} = require('./patcher');

describe('patcher', function() {
  let patchmap;
  let originalPatchMap;
  before(function() {
    patchmap = patcher.getPatchMap();
    originalPatchMap = new Map([...patchmap.entries()]);
  });
  after(function() {
    patchmap.clear();
    for (const [key, entry] of originalPatchMap.entries()) {
      patchmap.set(key, entry);
    }
  });

  afterEach(function() {
    emitter.removeAllListeners();
  });

  it('http, https, and @contrast/agent should be patchable', function() {
    ['http', 'https', '@contrast/agent'].forEach(m => {
      const has = patchmap.has(m);
      const is = patchmap.get(m);
      expect(has).equal(true, `${m} should be in the patchmap`);
      expect(is).property('name').equal(m);
      expect(is).property('isPatched').equal(false, `${m} should not be patched`);
    });
  });

  it('require should not be modified before enabling', function() {
    expect(module.constructor.prototype.require).equal(Require);
  });

  it('require should be modified after enabling', function() {
    patcher.enable();
    expect(module.constructor.prototype.require).not.equal(Require);
  });

  it('require should not be modified when disabled', function() {
    patcher.disable();
    expect(module.constructor.prototype.require).equal(Require);
  });

  it('normal error when the target does not not exist', function() {
    patcher.enable();
    patchmap.set('not-here', {name: 'not-here', isPatched: false});
    const listener = (event, message) => {
      throw new Error('patcher should not emit a message');
    };
    emitter.on('patch', listener);
    emitter.on('error', listener);
    let error;
    try {
      require('not-here');
    } catch (e) {
      error = e;
    }
    expect(error).property('code').equal('MODULE_NOT_FOUND');
  });

  it('emits errors and returns unmodified module when patching fails', function() {
    // the patcher is still enabled
    const original = require('../test/patcher/good-target');
    const target = '../test/patcher/good-target';
    const badPatcher = require('../test/patcher/bad-patcher');
    const badPatcherInfo = {name: target, isPatched: false, patcher: badPatcher};
    patchmap.set(target, badPatcherInfo);

    const pListener = event => {
      throw new Error(`'patch' event should not be emitted for ${target}`);
    };
    const eListener = event => {
      expect(event.name).equal(target);
      expect(event.error).instanceof(TypeError);
      let message = 'Cannot read property \'hello\' of undefined';
      if (semver.gte(process.version, '16.0.0')) {
        message = 'Cannot read properties of undefined (reading \'hello\')';
      }
      expect(event.error.message).equal(message);
    };
    emitter.on('patch', pListener);
    emitter.on('error', eListener);

    const goodTarget = require('../test/patcher/good-target');
    expect(goodTarget).equal(original, 'require should match original');
    expect(badPatcherInfo).property('isPatched').equal(false);
  });

  it('emits a patch event when patching was successful', function() {
    patcher.disable();
    const original = require('../test/patcher/good-target');
    const target = '../test/patcher/good-target';
    const goodPatcher = require('../test/patcher/good-patcher');
    const goodPatcherInfo = {name: target, isPatched: false, patcher: goodPatcher};
    patchmap.set(target, goodPatcherInfo);

    let patchEvent;

    const pListener = event => {
      patchEvent = event;
    };
    const eListener = event => {
      throw new Error(`'error' event shoud not be emitted for ${target}`);
    };
    emitter.on('patch', pListener);
    emitter.on('error', eListener);

    patcher.enable();
    const goodTarget = require('../test/patcher/good-target');
    expect(goodTarget).equal(original);
    expect(goodPatcherInfo).property('isPatched').equal(true);
    expect(patchEvent).property('name').equal(target);
  });

});
