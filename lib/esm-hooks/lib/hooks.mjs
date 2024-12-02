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
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mappings} from './common.mjs';
import {getFileType} from './get-file-type.mjs';
//import { default as initLoaderAgent } from './loader-agent.mjs';
import {primordials} from '@contrast/common';
const {StringPrototypeSplit, BufferPrototypeToString} = primordials;

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
 * Agent instance with minimum footprint that handles functionality related esm module loading.
 * - We handles redirects to force require.
 * - Module rewriting via exported load hook
 * @type {import('./loader-agent.mjs').LoaderAgent=}
 */
let loaderAgent;

/**
 * Module.register callback
 * @param {import('./loader-agent.mjs').InitData} data
 */
function initialize(data = {}) {
  // this is where ports and other data are passed to the loader thread
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
  loaderAgent?.esmHooks?.debugEsmResolve?.(specifier);

  if (!loaderAgent?.enable) {
    return protectedNextResolve(specifier, context, nextResolve);
  }

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
  loaderAgent?.esmHooks?.debugEsmLoad?.(url);

  const urlObject = new URL(url);
  const type = await getFileType(url, loaderAgent?.appInfo.app_dir);

  // if it's not a builtin or a flagged file, it needs to be rewritten.
  // if it's not an es module it will be rewritten by the require hooks.
  if (!loaderAgent?.enable || urlObject.searchParams.has('csi-flag') || type !== 'module') {
    return nextLoad(url, context);
  }

  const filename = fileURLToPath(url);

  // Handles the event that other hooks redirect an import to a `.node` addon.
  if (filename.endsWith('.node')) {
    return {
      source: `module.exports = require("${filename}");`,
      format: 'commonjs',
      shortCircuit: true,
    };
  }

  if (loaderAgent.config.agent.node.rewrite.cache.enable) {
    const cachedURL = await loaderAgent.rewriter.cache.find(filename);
    if (cachedURL) {
      // allow other load hooks to run
      const loadResult = await nextLoad(pathToFileURL(cachedURL).href, context);
      // use original url so that import.meta.url and import.meta.resolve work as expected
      loadResult.responseURL = url;

      if (process.env.CSI_EXPOSE_CORE) {
        // only do this in testing scenarios
        loaderAgent.esmHooks.portClient.sendStatus('rewritten file loaded from cache', {
          cachedURL,
          responseURL: loadResult.responseURL,
        });
      }
      return loadResult;
    }
  }

  /** @type {import('@contrast/rewriter').RewriteOpts} */
  const rewriteOptions = {
    filename,
    isModule: true,
    inject: true,
    wrap: false, // cannot wrap modules
  };

  const {source} = await nextLoad(url, context);
  const rewriteResult = await loaderAgent.rewriter.rewrite(
    Buffer.isBuffer(source) ? BufferPrototypeToString.call(source) : source.toString(),
    rewriteOptions
  );

  if (process.env.CSI_EXPOSE_CORE) {
    // only do this in testing scenarios (todo: compose this functionality into test agents instead)
    loaderAgent.esmHooks.portClient.sendStatus('rewriting file during ESM load hook', rewriteOptions);
  }

  if (loaderAgent.config.agent.node.rewrite.cache.enable) {
    await loaderAgent.rewriter.cache.write(filename, rewriteResult);
  }

  return {
    source: rewriteResult.code,
    format: 'module',
    shortCircuit: true,
  };
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
