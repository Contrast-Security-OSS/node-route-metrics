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
import { IntentionalError } from '@contrast/common';
import { default as debugMethods } from './debug-methods.mjs';
import { default as portClient } from './post-message/loader-client.mjs';
const require = Module.createRequire(import.meta.url);

/**
 * @typedef {Object} InitData
 * @prop {import('@contrast/rewriter').Mode[]} modes
 * @prop {import('node:worker_threads').MessagePort} port
 * @prop {import('@contrast/common').AppInfo} appInfo
 * @prop {string} agentVersion
 */

/**
 * @typedef {Object} LoaderAgent
 * @prop {import('@contrast/common').Messages} messages
 * @prop {import('@contrast/common').AppInfo} appInfo
 * @prop {string} agentVersion
 * @prop {boolean} enable
 * @prop {Record<never, never>} esmHooks
 * @prop {import('@contrast/config').Config} config
 * @prop {import('@contrast/logger').Logger} logger
 * @prop {import('@contrast/rewriter').Rewriter} rewriter
 */

const ERROR_MESSAGE = 'An error prevented the Contrast agent from initializing in the loader thread.';

/**
 * @param {InitData} data
 * @returns {LoaderAgent}
 */
export default function init({ appInfo, agentVersion, port, modes, loggerFd }) {
  const threadTransferData = Object.create(null);
  threadTransferData.loggerFd = loggerFd;
  /** @type {LoaderAgent} */
  const core = {
    threadTransferData,
    Perf: require('@contrast/perf'),
    appInfo,
    agentVersion,
    // this will toggle functionality in hooks.mjs e.g. redirects/rewriting
    enable: true,
    // stub for debugMethods
    esmHooks: {},
    async install() {
      if (!modes?.length) {
        throw new Error('worker agent invalid state: no modes');
      }

      for (const mode of modes) {
        core.rewriter.install(mode);
      }

      debugMethods(core);
      core.esmHooks?.portClient?.sendStatus?.('initialized and installed esm loader agent');
    },
    uninstall() {
      core.enable = false;
    },
  };

  try {
    core.Perf = require('@contrast/perf');
    require('@contrast/core/lib/messages')(core);
    require('@contrast/config')(core);
    require('@contrast/logger').default(core);
    require('@contrast/rewriter')(core);
    portClient(core, { port });

    return core;
  } catch (err) {
    core.enable = false;

    // ignore intentional errors
    if (!(err instanceof IntentionalError)) {
      if (core.logger) {
        core.logger.error({ err }, ERROR_MESSAGE);
      } else {
        console.error(new Error(ERROR_MESSAGE, { cause: err }));
      }
    }
  }
}
