'use strict';

const BaseChecker = require('./_base');

class EventloopChecker extends BaseChecker {
  constructor(options = {}) {
    super(Object.assign({}, options, {type: 'eventloop'}));
  }
}

module.exports = EventloopChecker;
