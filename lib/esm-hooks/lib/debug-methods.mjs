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

import Module from 'node:module';
import * as process from 'node:process';
import { threadId as tid } from 'node:worker_threads';

const DEFAULT_OPTS = { mask: process.env.CSI_HOOKS_LOG, install: true };
const LOG_LOAD = 1;
const LOG_RESOLVE = 2;
const LOG_REQUIRE_ALL = 4;

export default function init(core, opts = DEFAULT_OPTS) {
  const { esmHooks } = core;

  if (!opts.mask) return;
  const LOG = +opts.mask;

  Object.assign(esmHooks, {
    _rawDebug(value) {
      process._rawDebug(value);
    },
    debugCjsCompile(filename) {
      (LOG & LOG_REQUIRE_ALL) && esmHooks._rawDebug(`CJS(${tid}) _compile() ${filename}`);
    },
    debugCjsExtensions(filename) {
      (LOG & LOG_REQUIRE_ALL) && esmHooks._rawDebug(`CJS(${tid}) extensions.js() ${filename}`);
    },
    debugCjsLoad(request) {
      (LOG & LOG_LOAD) && esmHooks._rawDebug(`CJS(${tid}) _load() ${request}`);
    },
    debugCjsRequire(moduleId) {
      (LOG & LOG_REQUIRE_ALL) && esmHooks._rawDebug(`CJS(${tid}) require() ${moduleId}`);
    },
    debugEsmInitialize(specifier) {
      LOG && esmHooks._rawDebug(`ESM(${tid}) initialize() ${specifier}`);
    },
    debugEsmResolve(specifier) {
      (LOG & LOG_RESOLVE) && esmHooks._rawDebug(`ESM(${tid}) resolve() ${specifier}`);
    },
    debugEsmLoad(url) {
      (LOG & LOG_LOAD) && esmHooks._rawDebug(`ESM(${tid}) load() ${url}`);
    },
  });

  if (opts.install) {
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function(moduleId) {
      esmHooks.debugCjsRequire(moduleId);
      return originalRequire.call(this, moduleId);
    };

    const originalCompile = Module.prototype._compile;
    Module.prototype._compile = function(code, filename) {
      esmHooks.debugCjsCompile(filename);
      return originalCompile.call(this, code, filename);
    };

    const originalExtensions = Module._extensions['.js'];
    Module._extensions['.js'] = function(module, filename) {
      esmHooks.debugCjsExtensions(filename);
      return originalExtensions.call(this, module, filename);
    };

    const originalLoad = Module._load;
    Module._load = function(request, parent, isMain) {
      esmHooks.debugCjsLoad(request);
      return originalLoad.call(this, request, parent, isMain);
    };
  }
  return esmHooks;
}
