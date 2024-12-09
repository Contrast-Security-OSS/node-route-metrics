'use strict';

// the abstract base class for all checkers. all checkers must implement these
// methods. the simplest checkers, which only count how many entries they've
// seen, don't need to implement anything.

class BaseChecker {
  constructor(options = {}) {
    if (!options.type) {
      throw new Error('BaseChecker requires a type');
    }
    this.type = options.type;
    this.requiredEntries = options.requiredEntries || 0;

    this.entryCount = 0;
  }

  check(entry) {
    this.entryCount += 1;
  }

  getNumberOfRequiredEntries() {
    return this.requiredEntries;
  }

  getCount() {
    return this.entryCount;
  }
}

module.exports = BaseChecker;
