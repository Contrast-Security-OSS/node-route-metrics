'use strict';

const BaseChecker = require('./_base');

class GcChecker extends BaseChecker {
  constructor(options = {}) {
    super(Object.assign({}, options, {type: 'gc'}));
  }
}

module.exports = GcChecker;
