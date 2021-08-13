'use strict';

const patch = require('./http');

module.exports = function(m, options) {
  return patch(m, options);
};
