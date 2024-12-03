/*
 * Copyright: 2024 Contrast Security, Inc
 * Contact: support@contrastsecurity.com
 * License: Commercial

 * NOTICE: This Software and the patented inventions embodied within may only be
 * used as part of Contrast Security’s commercial offerings. Even though it is
 * made available through public repositories, use of this Software is subject to
 * the applicable End User Licensing Agreement found at
 * https://www.contrastsecurity.com/enduser-terms-0317a or as otherwise agreed
 * between Contrast Security and the End User. The Software may not be reverse
 * engineered, modified, repackaged, sold, redistributed or otherwise used in a
 * way not consistent with the End User License Agreement.
 */

import * as process from 'node:process';
import {fileURLToPath} from 'node:url';
import {mappings} from './common.mjs';
import {getFileType} from './get-file-type.mjs';

import primordials from '../primordials.mjs';
const {StringPrototypeEndsWith, StringPrototypeSplit} = primordials;

const [major, minor] = StringPrototypeSplit.call(process.versions.node, '.').map(it => +it);
const isLT16_12 = major < 16 || (major === 16 && minor < 12);

/**
 * @typedef {Object} ResolveResult
 * @prop {string=} format A hint to the load hook (it might be ignored) 'builtin' | 'commonjs' | 'json' | 'module' | 'wasm'
 * @prop {Object=} importAssertions The import assertions to use when caching the module (optional; if excluded the input will be used) (before v21)
 * @prop {Object=} importAttributes The import attributes to use when caching the module (optional; if excluded the input will be used) (after v21)
 * @prop {boolean=} shortCircuit A signal that this hook intends to terminate the chain of `resolve` hooks. Default: `false`
 * @prop {string} url The absolute URL to which this input resolves
 */

/**
 * @typedef {Object} LoadResult
 * @prop {string} format
 * @prop {boolean=} shortCircuit A signal that this hook intends to terminate the chain of resolve hooks. Default: `false`
 * @prop {string | ArrayBuffer | TypedArray} source The source for Node.js to evaluate
 */


/**
 * Module.register callback
 * @param {import('./xxx-loader-agent.mjs').InitData} data
 */
function initialize(data = {}) {
  const {port} = data;
  port.postMessage({type: 'status', ts: Date.now(), status: 'initializing'});
}
// async function initialize(data = {}) {
//   loaderAgent = initLoaderAgent(data);
//   loaderAgent.esmHooks.debugEsmInitialize?.();
//   await loaderAgent.install();
// }

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
  const type = await getFileType(url, '.'); // TODO BAM need to pass correct app root.

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
    if (context.conditions.at(-1) === 'node-addons' || context.importAssertions || context.importAttributes || isLT16_12) {
      return nextResolve(specifier, context);
    }
  }

  return nextResolve(specifier);
}

export {initialize, resolve, load};
