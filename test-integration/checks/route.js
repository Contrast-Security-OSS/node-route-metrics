'use strict';

const BaseChecker = require('./_base');

class RouteChecker extends BaseChecker {
  constructor(options = {}) {
    super(Object.assign({}, options, {type: 'route'}));
  }
}

module.exports = RouteChecker;
