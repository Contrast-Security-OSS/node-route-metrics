'use strict';

const config = require('./common-config');

module.exports = {
  get() {
    return config.get({defs: 'agent'});
  }
};

if (module.main === module) {
  // eslint-disable-next-line no-console
  console.log(module.exports.get());
}
