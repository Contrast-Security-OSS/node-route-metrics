'use strict';

const BaseChecker = require('./_base');

class CustomChecker extends BaseChecker {
  constructor(options = {}) {
    if (!options.type) {
      throw new Error('CustomChecker requires a type');
    }
    super(options);
  }
}

module.exports = CustomChecker;
