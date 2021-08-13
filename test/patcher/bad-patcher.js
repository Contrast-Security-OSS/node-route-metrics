'use strict';

module.exports = function(m, options) {
  m.prototype.hello.bruce = 'wakeup';
  return m;
};
