'use strict';


class ProcChecker {
  constructor(options = {}) {
    this.type = 'proc';
    this.requiredEntries = options.requiredEntries || 0;
    this.procEntryCount = 0;
  }

  check(entry) {
    // we could check the entry but we won't get here unless it's a route, so
    // until we add specific route-matching, there's no need.
    this.procEntryCount += 1;
  }

  getCountOfRequiredEntries() {
    return this.procEntryCount;
  }
}

module.exports = ProcChecker;
