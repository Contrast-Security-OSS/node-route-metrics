'use strict';

const config = require('./common-config');

const prefix = 'CSI_RM_';

const defs = {
  logFile: {def: 'route-metrics.log'},
  outputConfig: {def: null}
};

module.exports = {
  get() {
    return config.get({defs, prefix});
  }
};
