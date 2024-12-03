'use strict';

const Emitter = require('events');
const fs = require('node:fs');
const path = require('node:path');
const M = require('node:module');

const {StringPrototypeSplit} = require('./primordials.js');

const logAllLoads = process.env.CSI_RM_LOG_ALL_LOADS === 'true';

const Require = module.constructor.prototype.require;

const AGENTS = ['@contrast/agent'];
const patchmap = new Map();
const emitter = new Emitter();

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

// node 16.19.1 made -r @contrast/agent not accessible via require patching, so look at
// execArgv when we get the first require call starting with @contrast.
// https://github.com/nodejs/node/commit/b02d895137
let emitOnFirstContrastLoad;

const [major, minor, patch] = StringPrototypeSplit.call(process.versions.node, '.');
if (major > 16 || (major == 16 && minor > 19) || (major == 16 && minor == 19 && patch > 0)) {
  for (let i = 0; i < process.execArgv.length; i++) {
    if (['-r', '--require', '--import'].includes(process.execArgv[i])) {
      const ix = AGENTS.indexOf(process.execArgv[i + 1]);
      if (ix >= 0) {
        emitOnFirstContrastLoad = AGENTS[ix];
      }
    }
  }
} else {
  // add a special entry just to watch whether the agent's been loaded. this will
  // result in a 'patch' entry in the log file when the agent is loaded, even though
  // it's not really patched.
  for (const agent of AGENTS) {
    patchmap.set(agent, {
      name: agent,
      isPatched: false,
      patcher(m) {
        return m;
      }
    });
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
 * module via '-r' or '--require' on the command line (and possibly other situations).
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

  if (emitOnFirstContrastLoad && name.startsWith('@contrast')) {
    emitter.emit('patch', {name: emitOnFirstContrastLoad});
    emitOnFirstContrastLoad = undefined;
    return m;
  }

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
  emitter,
  AGENTS,
};
