'use strict';

const BaseReporter = require('./base-reporter.cjs');
const {f2, iso, stats, percentile} = require('./base-reporter.cjs');

class Reporter extends BaseReporter {
  constructor(stream, overallInfo, options) {
    super(stream, overallInfo, options);
    this.percentiles = [0.50, 0.70, 0.80, 0.90, 0.95];
  }

  async report(options) {
    // output informational text
    this.reportOverall();

    const rmr = this.rmr;

    /* eslint-disable no-console */
    console.log(`[start ${iso(rmr.earliestTimestamp)}, end ${iso(rmr.latestTimestamp)}]`);

    const groupingRules = {
      grouper: 'by-status-code',
      rules: options.template.routes || [],
    };

    const groups = rmr.route.groupBy(groupingRules);
    const rc = groups.size;

    let totalObs = 0;
    for (const statusCodes of groups.values()) {
      for (const status in statusCodes) {
        totalObs += statusCodes[status].length;
        if (!options.microseconds) {
          statusCodes[status] = statusCodes[status].map(t => Math.round(t / 1000));
        }
      }
    }

    console.log(`[total time measurements ${totalObs} across ${rc} routes]`);

    for (const p of rmr.patch.logObjects) {
      if (p.entry.name.startsWith('@contrast/agent')) {
        console.log(`[${p.entry.name} loaded]`);
        break;
      }
    }

    let totalTimeSeries = 0;
    for (const ts of rmr.getTimeSeries()) {
      totalTimeSeries += rmr[ts].count;
    }
    let gcInfo = '';
    if (rmr.gc.count !== 0) {
      gcInfo = ` (gc count ${rmr.gc.totalCount} gc time ${rmr.gc.totalTime})`;
    }
    console.log(`[time-series lines processed ${totalTimeSeries}${gcInfo}]`);

    const percentiles = this.percentiles.join(', ');
    this.outputStream.write(`route, status, n, mean, stddev, percentiles: ${percentiles}\n`);
    const sorted = Array.from(groups.keys());
    sorted.sort();

    for (const route of sorted) {
      const statusCodes = groups.get(route);
      for (const status in statusCodes) {
        const times = statusCodes[status];
        const {n, mean, stddev} = stats(times);
        const percentiles = percentile(this.percentiles, times);
        const line = [
          route, status, n, f2(mean), f2(stddev), ...percentiles
        ].join(',');
        this.outputStream.write(`${line}\n`);
      }
    }
    // console.log is synchronous and stream writes are not. informational text
    // is always written to the console. if the report is also being written to
    // the console, and there are multiple run summaries, that the output will
    // be interleaved incorrectly. so
    await new Promise(resolve => {
      this.outputStream.write('\n', resolve);
    });

  }
}

module.exports = Reporter;
