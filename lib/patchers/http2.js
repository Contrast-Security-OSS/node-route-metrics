'use strict';

const patch = require('./http');

// it's not clear that just patching .emit('request', ...) and .end() addresses
// all the ways that http2 can be used. but i don't know enough about it right
// now so am deferring to a later date.

module.exports = function(m, options) {
  return patch(m, options);
};
