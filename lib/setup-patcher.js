'use strict';

module.exports = function patcherSetup({type}, patchListener, loadListener) {
  // the require patcher gets setup for both types: esm and cjs
  const {patcher, emitter: patchEmitter} = require('./patcher');
  patcher.enable();
  patchEmitter.on('patch', patchListener);
  patchEmitter.on('load', loadListener);

  if (type === 'cjs') {
    return;
  }

  // this was invoked via --import so we need to setup the esm loader thread.
};
