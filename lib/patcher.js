'use strict';

const Emitter = require('events');
const fs = require('node:fs');
const path = require('node:path');
const M = require('node:module');

const Require = module.constructor.prototype.require;

const patchmap = new Map();
const emitter = new Emitter();

let logAllLoads = false;

// build the library of patchers at startup. it's only http code, but this is
// extensible if ever needed.
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

/**
 * @function patcher
 *
 * patcher replaces the module constructor's prototype require function. when a
 * module is required, patcher is invoked. it uses the original require function
 * to load the module and, if the module is in the patch map, invokes the code to
 * patch the module.
 *
 * N.B. as of node 16.19.1 this will not be invoked when node internally loads a
 * module via '-r' or '--require' on the command line. neither this nor the esm
 * hooks are invoked with a module is loaded via --import.
 *
 * @param {string} name name of the module to be loaded
 * @returns {object} the loaded module, possibly patched
 */
function patcher(name) {
  let resolvedName;
  try {
    resolvedName = M._resolveFilename(name, this, false);
  } catch (e) {
    // not sure try matters here, so skip it? or let the error
    // come from require, as it normally would? net, i don't think
    // we can hit the following line AND not throw an error on the
    // following require because it eventually makes a
    // _resolveFilename call.
    resolvedName = name;
  }

  const m = Require.call(this, name);

  // if it's not present in the map then we don't want to patch it.
  const patchInfo = patchmap.get(name);
  if (!patchInfo || patchInfo.isPatched) {
    // emit a "load" event for every require call if CSI_RM_LOG_ALL_LOADS is
    // set
    if (logAllLoads && !patchInfo) {
      emitter.emit('load', {name: resolvedName});
    }
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

patcher.enable = function(options = {}) {
  if (options.logAllLoads) {
    logAllLoads = true;
  }
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
  emitter,
};
