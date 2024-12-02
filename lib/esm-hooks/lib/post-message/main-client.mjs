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
 * Handles main agent communication with the loader agent's port client.
 * Has API to forward events, and for sending RPC-like messages e.g. for instructing it to disable.
 * Will listen for status messages from the loader agent and log them.
 * @param {any} core
 * @param {Object} opts
 * @param {import('node:worker_threads').MessagePort} opts.port
 */
export default function init(core, { port }) {
  const portClient = core.esmHooks.portClient = {
    _port: port,
    _handlers: {
      status(msg, data) {
        core.logger.trace({ name: 'contrast:esm:loader', data }, msg);
      },
    },
    /**
     * Forward events e.g. SERVER_SETTINGS_UPDATE
     */
    sendEvent(event, data) {
      send(port, { type: event, ...data });
    },
    /**
     * Tell the loader agent to do something e.g. disable/uninstall
     */
    sendRPC(action, data) {
      send(port, { type: 'rpc', action, data });
    },
  };

  // handling messages from loader agent
  portClient._port.on('message', (raw) => {
    if (raw?.type == 'status') {
      portClient._handlers.status(raw.msg, raw.data);
    }
  });

  // forward settings updates to loader agent via port
  core.messages.on(Event.SERVER_SETTINGS_UPDATE, (msg) => {
    portClient.sendEvent(Event.SERVER_SETTINGS_UPDATE, msg);
  });

  // do this after 'message' listeners are added, otherwise that process will automatically ref again
  // https://nodejs.org/api/worker_threads.html#portunref
  port.unref();

  return portClient;
}
