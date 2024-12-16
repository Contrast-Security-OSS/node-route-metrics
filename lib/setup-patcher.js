'use strict';

module.exports = function patcherSetup(patchListener, loadListener) {
  // the require patcher gets setup for both types: esm and cjs
  const {patcher, emitter: patchEmitter} = require('./patcher');
  // the presence of the loadListener is used as a flag so that 'load' events
  // won't be emitted when they are not enabled.
  patcher.enable({logAllLoads: !!loadListener});
  patchEmitter.on('patch', patchListener);
  if (loadListener) {
    patchEmitter.on('load', loadListener);
  }
};
