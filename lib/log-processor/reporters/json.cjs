'use strict';

const BaseReporter = require('./base-reporter.cjs');

class Reporter extends BaseReporter {
  constructor(outputStream, overallInfo, options) {
    super(outputStream, overallInfo, options);
  }

  reportOverall() {
    // do nothing
  }

  async report(options = {}) {
    // don't output lines in the JSON summary
    // const logLines = this.runSummaries.map(s => {
    //   const lines = s.lines;
    //   delete s.lines;
    //   return lines;
    // });
    // need to make summary here or elsewhere.
    const groupingRules = {
      grouper: 'by-status-code',
      rules: options?.template.routes || [],
    };

    const groups = this.rmr.route.groupBy(groupingRules);
    // i am not sure what i was thinking to fill in not-present time series
    // with 0 values, but i did. so duplicate it now.
    const timeSeries = {
      proc: {
        count: 0,
        firstTime: 0,
        lastTime: 0,
        first: undefined,
        last: undefined,
        cpuUserTotal: 0,
        cpuSystemTotal: 0,
        cpuUserPercent: 0,
        cpuSystemPercent: 0
      },
      gc: {count: 0, firstTime: 0, lastTime: 0, first: undefined, last: undefined, gcCount: 0, gcTime: 0},
      eventloop: {count: 0, firstTime: 0, lastTime: 0, first: undefined, last: undefined},
    };
    for (const ts of this.rmr.getTimeSeriesPresent()) {
      timeSeries[ts].count = this.rmr[ts].count;
      timeSeries[ts].firstTime = this.rmr[ts].earliestTimestamp;
      timeSeries[ts].lastTime = this.rmr[ts].latestTimestamp;

      if (ts === 'proc') {
        timeSeries.proc.first = this.rmr.proc.logObjects[0];
        timeSeries.proc.last = this.rmr.proc.logObjects.at(-1);
        timeSeries.proc.cpuUserTotal = this.rmr.proc.totalUser;
        timeSeries.proc.cpuSystemTotal = this.rmr.proc.totalSystem;

        const {user, system} = this.rmr[ts].cpuPercents;
        timeSeries[ts].cpuUserPercent = user / 100;
        timeSeries[ts].cpuSystemPercent = system / 100;
      } else if (ts === 'gc') {
        timeSeries.gc.first = this.rmr[ts].logObjects[0];
        timeSeries.gc.last = this.rmr[ts].logObjects.at(-1);
        timeSeries.gc.gcCount = this.rmr.gc.totalCount;
        timeSeries.gc.gcTime = this.rmr.gc.totalTime;
      } else if (ts === 'eventloop') {
        timeSeries.eventloop.first = this.rmr[ts].logObjects[0];
        timeSeries.eventloop.last = this.rmr[ts].logObjects.at(-1);
      } else {
        throw new Error(`invalid time series: ${ts}`);
      }
    }

    const summary = {
      header: this.rmr.header.logObjects[0],
      routes: [...groups.entries()],
      patches: [...this.rmr.patch.logObjects],
      statuses: [...this.rmr.status.logObjects],
      unknown: [], // this cannot happen any longer; RouteMetricsResults throws
      timeSeries,
      firstTimestamp: this.rmr.earliestTimestamp,
      lastTimestamp: this.rmr.latestTimestamp,
      // these potentially had meaning if an "append" mode was added for the log file
      firstLine: 1,
      lastLine: this.linesRead,
      meta: {keyToProperties: makeKeyToProperties(groups)},

    };

    const summaryText = JSON.stringify(summary, null, 2);

    const needToWait = false === this.outputStream.write(summaryText);

    if (needToWait) {
      await new Promise(resolve => {
        this.outputStream.once('drain', resolve);
      });
    }
    // restore the lines
    // for (let i = 0; i < this.runSummaries.length; i++) {
    //   this.runSummaries[i].lines = logLines[i];
    // }

    return new Promise(resolve => {
      this.outputStream.write('\n', resolve);
    });
  }
}

function makeKeyToProperties(routes) {
  //
  // decode the routes into an index for easier filtering. the routes are keyed
  // by a string like "GET https://x.y.com:443/path". this creates a parallel map
  // indexed by the same key with a value of {method: "GET", path: "/path"} so that
  // those do not need to be extracted for matching against template buckets.
  //
  const re = /([^ ]+) https?:\/\/[^/]+(.+)/;
  const keyToProperties = {};
  for (const [key] of routes) {
    const m = key.match(re);
    const props = {};
    if (m) {
      props.method = m[1];
      props.path = m[2];
      keyToProperties[key] = props;
    } else {
      // ? add to errors?
    }
  }

  return keyToProperties;
}

module.exports = Reporter;
