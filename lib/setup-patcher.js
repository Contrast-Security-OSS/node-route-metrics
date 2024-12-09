'use strict';

module.exports = function patcherSetup(patchListener, loadListener) {
  // the require patcher gets setup for both types: esm and cjs
  const {patcher, emitter: patchEmitter} = require('./patcher');
  patcher.enable();
  patchEmitter.on('patch', patchListener);
  patchEmitter.on('load', loadListener);
};
