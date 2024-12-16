'use strict';

const BaseChecker = require('./_base');

class LoadChecker extends BaseChecker {
  constructor(options = {}) {
    super(Object.assign({}, options, {type: 'load'}));
  }
}

module.exports = LoadChecker;
