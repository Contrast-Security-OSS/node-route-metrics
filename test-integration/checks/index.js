'use strict';

const fsp = require('fs').promises;

class Checkers {
  constructor(options = {}) {
    this.checkers = {
      // header
      // patch
      // route
      // gc
      // eventloop
      // proc
      // custom
    };
    const {
      initialCheckers = [],
      filename = 'route-metrics.log',
    } = options;

    this.filename = filename;

    for (const {CheckerClass, constructorArgs} of initialCheckers) {
      const checker = new CheckerClass(...constructorArgs);
      this.add(checker);
    }
  }

  add(checker) {
    this.checkers[checker.type] = checker;
  }

  getChecker(type) {
    return this.checkers[type];
  }

  check(entries) {
    for (let i = 0; i < entries.length; i++) {
      const {type, entry} = entries[i];

      if (this.checkers[type]) {
        // passing the index allows the checker to handle ordering constraints
        this.checkers[type].check(entry, {index: i});
      }
    }
  }

  getRequiredEntriesCount() {
    let numberOfLinesNeeded = 0;
    const specificCountsNeeded = Object.create(null);
    for (const key in this.checkers) {
      const countNeeded = this.checkers[key].getNumberOfRequiredEntries();
      specificCountsNeeded[key] = countNeeded;
      numberOfLinesNeeded += countNeeded;
    }

    return {numberOfLinesNeeded, specificCountsNeeded};
  }

  async waitForLogLines(options = {}) {
    const {numberOfLinesNeeded, specificCountsNeeded} = this.getRequiredEntriesCount();

    const maxWaitTime = ('maxWaitTime' in options) ? options.maxWaitTime : 100;
    const loopWaitTime = ('loopWaitTime' in options) ? options.loopWaitTime : 10;
    const maxTries = Math.ceil(maxWaitTime / loopWaitTime);
    const start = Date.now();

    let lines;
    let text;
    let foundAll = false;
    for (let tries = 0; tries < maxTries; tries++) {
      text = await fsp.readFile(this.filename, {encoding: 'utf8'});
      lines = text.split('\n').slice(0, -1);
      const logObjects = lines.map(line => JSON.parse(line));
      if (lines.length >= numberOfLinesNeeded && this.haveAllRequestedLines(logObjects, specificCountsNeeded)) {
        foundAll = true;
        break;
      } else {
        await this.wait(loopWaitTime);
      }
    }
    return {
      text,
      lines,
      numberOfLinesNeeded,
      foundAll,
      waitTime: Date.now() - start
    };
  }

  /**
   * allRequestLines() returns true if the minimum number of each required
   * type of log entry has been found. because it can be called multiple
   * times, but is called with all log entries - not just the new entries -
   * it does not modify the `needed` object; it copies it each time.
   */
  haveAllRequestedLines(logObjects, specificCountsNeeded) {
    // copy
    const neededCounts = Object.assign({}, specificCountsNeeded);
    // get rid of keys that are not needed
    for (const key in neededCounts) {
      if (neededCounts[key] === 0) {
        delete neededCounts[key];
      }
    }

    // loop through each line of the file (it's been JSON.parsed)
    for (const line of logObjects) {
      if (line.type in neededCounts) {
        neededCounts[line.type] -= 1;
        // if the needCount is 0 then no more are needed.
        if (neededCounts[line.type] <= 0) {
          delete neededCounts[line.type];
          // all needs met?
          if (Object.keys(neededCounts).length === 0) {
            return true;
          }
        }
      }
    }

    return false;
  }

  wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}


module.exports = {
  // checker classes
  Checkers,
  HeaderChecker: require('./header'),
  PatchChecker: require('./patch'),
  RouteChecker: require('./route'),
  ProcChecker: require('./proc'),
  GcChecker: require('./gc'),
  EventloopChecker: require('./eventloop'),
  CustomChecker: require('./custom'),
};
