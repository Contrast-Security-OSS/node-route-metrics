'use strict';

const fsp = require('fs').promises;

/**
 * waitForLines() will wait for either a specific number of lines or for specified
 * lines to appear in the log file. the original implementation was for a number
 * lines but was problematic with the introduction of time-series entries (gc and
 * eventloop). if an object is passed it contains a required count for each entry
 * type (header, patch, eventloop, gc, metrics). passing an object allows the log
 * entries to appear in any order; if the order needs to be checked, it is the
 * caller's responsibility.
 *
 * Example object argument: {header: 1, patch: 1, gc: 1, eventloop: 1, proc: 1}
 *
 * @param {number|object} needed number of lines to wait for or an object as described
 * @param {object} options finer control over the waiting process
 * @return {object} {
 *   text: string,
 *   lines: string[],
 *   linesNeeded: number,
 *   foundAll: boolean,
 *   waitTime: number
 * }
 */
async function waitForLogLines(needed, options = {}) {
  let linesNeeded = 0;
  if (typeof needed === 'number') {
    linesNeeded = needed;
    needed = {};
  } else {
    linesNeeded = countLinesNeeded(needed);
  }
  const maxWaitTime = ('maxWaitTime' in options) ? options.maxWaitTime : 100;
  const loopWaitTime = ('loopWaitTime' in options) ? options.loopWaitTime : 10;
  const maxTries = Math.ceil(maxWaitTime / loopWaitTime);
  const start = Date.now();

  let lines;
  let text;
  let foundAll = false;
  for (let tries = 0; tries < maxTries; tries++) {
    text = await fsp.readFile('route-metrics.log', {encoding: 'utf8'});
    lines = text.split('\n').slice(0, -1);
    const logObjects = lines.map(l => JSON.parse(l));
    if (lines.length >= linesNeeded && allRequestedLines(logObjects, needed)) {
      foundAll = true;
      break;
    } else {
      await wait(loopWaitTime);
    }
  }
  return {text, lines, linesNeeded, foundAll, waitTime: Date.now() - start};
}

function countLinesNeeded(typesNeeded) {
  return Object.keys(typesNeeded).reduce((ac, key) => ac + typesNeeded[key], 0);
}

/**
 * allRequestLines() returns true if the minimum number of each required
 * type of log entry has been found. because it can be called multiple
 * times, but is called with all log entries - not just the new entries -
 * it does not modify the `needed` object; it copies it each time.
 */
function allRequestedLines(logObjects, needed) {
  const defaultsNeeded = {
    header: 1,
    patch: 0,
    gc: 0,
    eventloop: 0,
    metric: 0,
  };
  // copy
  const needCounts = Object.assign({}, defaultsNeeded, needed);
  // get rid of keys that are not needed
  for (const key in needCounts) {
    if (needCounts[key] === 0) {
      delete needCounts[key];
    }
  }

  // loop through each line of the file (it's been JSON.parsed)
  for (const line of logObjects) {
    if (line.type in needCounts) {
      needCounts[line.type] -= 1;
      // if the needCount is 0 then no more are needed.
      if (needCounts[line.type] === 0) {
        delete needCounts[line.type];
        // all needs met?
        if (Object.keys(needCounts).length === 0) {
          return true;
        }
      }
    }
  }

  return false;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = {
  waitForLogLines,
};
