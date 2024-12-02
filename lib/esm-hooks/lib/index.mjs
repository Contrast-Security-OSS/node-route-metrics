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
import {MessageChannel} from 'node:worker_threads';
import {default as debugMethods} from './debug-methods.mjs';
import {default as portClient} from './post-message/main-client.mjs';

export default function init() {
  const {
    port1: mainPort,
    port2: loaderPort
  } = new MessageChannel();


  const esmHooks = {

    async install() {
      const data = {
        port: loaderPort,
        // send fd?
      };

      // Instantiate loader thread via register (if available) or manually.
      // we can simplify when all LTS versions support register
      if (Module.register) {
        await Module.register('./hooks.mjs', import.meta.url, {
          data,
          transferList: [loaderPort],
        });
      } else {
        const {initialize, resolve, load} = await import('./hooks.mjs');
        await initialize(data);
        esmHooks.hooks = {resolve, load};
      }

      // these have side-effects, so compose during installation phase
      debugMethods();
    },
  };

  // how to handle this?
  //portClient(core, {port: mainPort});

  return esmHooks;
}
