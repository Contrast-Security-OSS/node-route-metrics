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

import { Event } from '@contrast/common';
import { send } from './send.mjs';

/**
 * Handles loader agent communication with the main agent's port client.
 * Has API to send status messages to main agent e.g. for when it installs/uninstalls.
 * Also listens for for TS settings updates and messages from main agent instructing it to disable.
 * @param {any} core
 * @param {Object} opts
 * @param {import('node:worker_threads').MessagePort} opts.port
*/
export default function init(core, { port }) {
  const portClient = core.esmHooks.portClient = {
    _port: port,
    _handlers: {
      disable() {
        core.uninstall?.();
        portClient.sendStatus('loader agent has been uninstalled');
      },
    },
    sendStatus(msg, data) {
      send(port, { type: 'status', msg, data });
    },
  };

  port.on('message', (raw) => {
    if (raw?.type === Event.SERVER_SETTINGS_UPDATE) {
      // forward main agent settings updates to loader components
      core.messages.emit(Event.SERVER_SETTINGS_UPDATE, raw);
    }

    if (raw?.type === 'rpc') {
      // dispatch appropriately
      portClient._handlers[raw.action]?.(raw.data);
    }
  });

  // do this after 'message' listeners are added, otherwise that process will automatically ref again
  // https://nodejs.org/api/worker_threads.html#portunref
  port.unref();

  return portClient;
}
