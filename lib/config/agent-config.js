'use strict';

const config = require('./common-config');

const prefix = 'CSI_RM_';

const defs = {
  logFile: {def: 'route-metrics.log'},
  outputConfig: {def: ''},
  garbageCollection: {def: false},
  eventloop: {def: false},
  eventloopResolution: {def: 20},      // ms
};

module.exports = {
  get() {
    return config.get({defs, prefix});
  }
};

if (module.main === module) {
  // eslint-disable-next-line no-console
  console.log(module.exports.get());
}
