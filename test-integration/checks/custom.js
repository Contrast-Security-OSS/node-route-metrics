'use strict';


class CustomChecker {
  constructor(options = {}) {
    if (!options.type) {
      throw new Error('CustomChecker requires a type');
    }
    this.type = options.type;
    this.requiredEntries = options.requiredEntries || 0;
    this.entryCount = 0;
  }

  getCountOfRequiredEntries() {
    return this.requiredEntries;
  }

  check(entry) {
    this.entryCount += 1;
  }

  getEntryCount() {
    return this.entryCount;
  }
}

module.exports = CustomChecker;
