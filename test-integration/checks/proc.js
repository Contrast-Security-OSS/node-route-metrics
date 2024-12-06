'use strict';

const BaseChecker = require('./_base');

class ProcChecker extends BaseChecker {
  constructor(options = {}) {
    super(Object.assign({}, options, {type: 'proc'}));
  }
}

module.exports = ProcChecker;
