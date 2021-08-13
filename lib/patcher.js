'use strict';

const Emitter = require('events');
const fs = require('fs');
const path = require('path');

const Require = module.constructor.prototype.require;

const patchmap = new Map();
const emitter = new Emitter();

// build the library of patchers at startup
const patchers = fs.readdirSync(`${__dirname}/patchers`);

for (let i = 0; i < patchers.length; i++) {
  if (!patchers[i].endsWith('.js')) {
    continue;
  }
  const name = path.basename(patchers[i], '.js');
  const patchInfo = {name, isPatched: false};
  try {
    patchInfo.patcher = require(`${__dirname}/patchers/${name}`);
    patchmap.set(name, patchInfo);
  } catch (e) {
    emitter.emit('patch', {name, error: e});
  }
}

// add a special entry just to watch whether the agent's been
// loaded. this will result in a 'patch' entry in the log file
// when the agent is loaded.
patchmap.set('@contrast/agent', {
  name: '@contrast/agent',
  isPatched: false,
  patcher(m) {
    return m;
  }
});

/**
 * @function patcher
 *
 * patcher replaces the module constructor's prototype require function. when a
 * module is required, patcher is invoked. it uses the original require function
 * to load the module and, if the module is in the patch map, invokes the code to
 * patch the module.
 *
 * @param {string} name name of the module to be loaded
 * @returns {object} the loaded module, possibly patched
 */
function patcher(name) {
  const m = Require.call(this, name);

  // if it's not present then we don't want to patch it.
  const patchInfo = patchmap.get(name);
  if (!patchInfo || patchInfo.isPatched) {
    return m;
  }

  try {
    patchInfo.patcher(m, {name});
    patchInfo.isPatched = true;
    emitter.emit('patch', {name});
  } catch (e) {
    emitter.emit('error', {name, error: e});
  }
  return m;
}

patcher.enable = function() {
  module.constructor.prototype.require = patcher;
};

patcher.disable = function() {
  module.constructor.prototype.require = Require;
};

patcher.getPatchMap = function() {
  return patchmap;
};

module.exports = {
  patcher,
  emitter
};
