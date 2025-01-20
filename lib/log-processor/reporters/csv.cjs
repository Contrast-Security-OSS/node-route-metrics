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

    for (const rmr of this.routeMetricsResults) {
      /* eslint-disable no-console */
      //this.stream.write(`[start ${iso(rmr.earliestTimestamp)}, end ${iso(rmr.latestTimestamp)}]\n`);
      // if (!this.isStdout) {
      console.log(`[start ${iso(rmr.earliestTimestamp)}, end ${iso(rmr.latestTimestamp)}]`);
      // }
      // this is routes, while what is calculated after this is route/status
      // combinations. not sure that is what should be reported.
      //const routes = Object.entries(rmr.routesIndex);

      const groups = rmr.route.groupBy(options.template.routes || []);
      //const compat = rmr.route.compatGetRoutesByStatusCode();
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
      //this.stream.write(`[total time measurements ${totalObs} across ${rc} routes]\n`);
      // if (!this.isStdout) {
      console.log(`[total time measurements ${totalObs} across ${rc} routes]`);
      // }

      for (const p of rmr.patch.logObjects) {
        if (p.entry.name.startsWith('@contrast/agent')) {
          // this.stream.write(`[${p.entry.name} loaded]\n`);
          // if (!this.isStdout) {
          console.log(`[${p.entry.name} loaded]`);
          // }
          break;
        }
      }

      let totalTimeSeries = 0;
      for (const ts of ['proc', 'gc', 'eventloop']) {
        totalTimeSeries += rmr[ts].count;
      }
      let gcInfo = '';
      if (totalTimeSeries) {
        if (rmr.gc.count !== 0) {
          gcInfo = ` (gc count ${rmr.gc.totalCount} gc time ${rmr.gc.totalTime})`;
        }
      }
      //this.stream.write(`[time-series lines processed ${totalTimeSeries}${gcInfo}]\n`);
      // if (!this.isStdout) {
      console.log(`[time-series lines processed ${totalTimeSeries}${gcInfo}]`);
      // }

      const percentiles = this.percentiles.join(', ');
      this.stream.write(`route, status, n, mean, stddev, percentiles: ${percentiles}\n`);
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
          this.stream.write(`${line}\n`);
        }
      }
      // console.log is synchronous and stream writes are not. informational text
      // is always written to the console. if the report is also being written to
      // the console, and there are multiple run summaries, that the output will
      // be interleaved incorrectly. so
      await new Promise(resolve => {
        this.stream.write('\n', resolve);
      });
    }
  }
}

module.exports = Reporter;
