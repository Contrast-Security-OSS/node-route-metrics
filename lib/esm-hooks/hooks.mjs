import {fileURLToPath} from 'node:url';
import M from 'node:module';
const require = M.createRequire(import.meta.url);

import {mappings} from './common.mjs';
import {getFileType} from './get-file-type.mjs';

import primordials from '../primordials.mjs';
const {StringPrototypeEndsWith} = primordials;

//
// initialize is called in the loader thread. it receives data passed from the
// register() call, including the port to communicate with the main thread.
//
const initData = {};

async function initialize(data = {}) {
  Object.assign(initData, data);
  initData.app_dir = initData.app_dir || '.';
  const {port, env} = initData;
  // add any environment variables passed from the main thread
  Object.assign(process.env, env);

  const tid = (await import('node:worker_threads')).threadId;

  const setupPatcher = require('../setup-patcher.js');

  function patchListener(m) {
    port.postMessage({type: 'patch', ts: Date.now(), tid, m});
  }
  let loadListener;
  if (env.CSI_RM_LOG_ALL_LOADS) {
    // listen for load events and forward them to main thread for logging.
    loadListener = (m) => {
      port.postMessage({type: 'load', ts: Date.now(), tid, m});
    };
  }
  setupPatcher(patchListener, loadListener);

  port.postMessage({type: 'status', ts: Date.now(), m: {status: 'initializing'}});
}

/**
 * @param {string} specifier
 * @param {Object} context
 * @param {string[]} context.conditions Export conditions of the relevant package.json
 * @param {Object=} context.importAssertions An object whose key-value pairs represent the assertions for the module to import (before v21)
 * @param {Object=} context.importAttributes An object whose key-value pairs represent the attributes for the module to import (after v21)
 * @param {string=} context.parentURL The module importing this one, or undefined if this is the Node.js entry point
 * @param {(specifier, context) => Promise<ResolveResult>} nextResolve The subsequent resolve hook in the chain, or the Node.js default resolve hook after the last user-supplied resolve hook
 * @returns {Promise<ResolveResult>}
 */
async function resolve(specifier, context, nextResolve) {
  let isFlaggedToPatch = false;
  if (context.parentURL) {
    isFlaggedToPatch = new URL(context.parentURL).searchParams.has('csi-flag');
  }

  if (!isFlaggedToPatch && specifier in mappings) {
    return {
      url: mappings[specifier],
      format: 'module',
      shortCircuit: true,
    };
  }

  return protectedNextResolve(specifier, context, nextResolve);
}

/**
 * @param {string} url The URL returned by the resolve chain
 * @param {Object} context
 * @param {string[]} context.conditions Export conditions of the relevant package.json
 * @param {string=} context.format The format optionally supplied by the resolve hook chain
 * @param {Object=} context.importAssertions (before v21)
 * @param {Object=} context.importAttributes (after v21)
 * @param {(url, context) => Promise<LoadResult>} nextLoad The subsequent load hook in the chain, or the Node.js default load hook after the last user-supplied load hook
 * @returns {Promise<LoadResult>}
 */
async function load(url, context, nextLoad) {

  const urlObject = new URL(url);
  const type = await getFileType(url, initData.app_dir);

  // if it's not a builtin or a flagged file, it needs to be rewritten.
  // if it's not an es module it will be rewritten by the require hooks.
  if (urlObject.searchParams.has('csi-flag') || type !== 'module') {
    return nextLoad(url, context);
  }

  const filename = fileURLToPath(url);

  // Handles the event that other hooks redirect an import to a `.node` addon.
  if (StringPrototypeEndsWith.call(filename, '.node')) {
    return {
      source: `module.exports = require("${filename}");`,
      format: 'commonjs',
      shortCircuit: true,
    };
  }

  return nextLoad(url, context);
}

/**
 * from https://github.com/iambumblehead/esmock/blob/main/src/esmockLoader.js#L89
 *
 * new versions of node: when multiple loaders are used and context
 * is passed to nextResolve, the process crashes in a recursive call
 * see: /esmock/issues/#48
 *
 * old versions of node: if context.parentURL is defined, and context
 * is not passed to nextResolve, the tests fail
 *
 * later versions of node v16 include 'node-addons'
 * @type {typeof resolve}
 */
async function protectedNextResolve(specifier, context, nextResolve) {
  if (context.parentURL) {
    if (context.conditions.at(-1) === 'node-addons' || context.importAssertions || context.importAttributes) {
      return nextResolve(specifier, context);
    }
  }

  return nextResolve(specifier);
}

export {initialize, resolve, load};
