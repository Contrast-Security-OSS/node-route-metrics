'use strict';

const BaseReporter = require('../base-reporter');

class Reporter extends BaseReporter {
  constructor(stream, overallInfo, options) {
    super(stream, overallInfo, options);
    this.percentiles = [0.50, 0.70, 0.80, 0.90, 0.95];
  }

  async report(options) {
    // output informational text
    this.reportOverall();

    for (const s of this.runSummaries) {
      /* eslint-disable no-console */
      console.log(`[start ${iso(s.firstTimestamp)}, end ${iso(s.lastTimestamp)}]`);
      const rc = s.metrics.length;
      let totalObs = 0;
      for (const [, timesByStatus] of s.metrics) {
        for (const status in timesByStatus) {
          totalObs += timesByStatus[status].length;
          if (!options.microseconds) {
            timesByStatus[status] = timesByStatus[status].map(t => Math.round(t / 1000));
          }
        }
      }
      console.log(`[total time measurements ${totalObs} across ${rc} routes]`);

      // note the agent is loaded if it is
      for (const p of s.patches) {
        if (!p.entry.name.startsWith('http')) {
          console.log(`[${p.entry.name} loaded]`);
          break;
        }
      }
      /* eslint-enable no-console */

      // sort the metrics so the percentiles work correctly.
      s.metrics.sort((a, b) => a === b ? 0 : a[0] < b[0] ? -1 : 1);

      const percentiles = this.percentiles.join(', ');

      this.stream.write(`route, status, n, mean, stddev, percentiles: ${percentiles}\n`);
      // route, status, n, ...percentiles
      if (!options.template) {
        this.writeSimple(s);
      } else {
        this.writeTemplateDriven(s, options.template);
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

  /**
   * Write the summary based on the raw route names.
   *
   * @param {object} summary a run summary.
   */
  writeSimple(summary) {
    const {metrics} = summary;

    // for each collected metric
    for (const [path, timesByStatus] of metrics) {
      // for each status code
      for (const status in timesByStatus) {
        const lowToHigh = (a, b) => a === b ? 0 : a < b ? -1 : 1;
        const times = timesByStatus[status].sort(lowToHigh);
        const {n, mean, stddev} = stats(times);
        const line = [
          path, status, n, f2(mean), f2(stddev), ...percentile(this.percentiles, times)
        ].join(',');
        //waitWriter(`${line}\n`);
        this.stream.write(`${line}\n`);
      }
    }
  }


  /**
   * Write the summary based grouped into buckets defined by the template.
   *
   * @param {object} summary a run summary
   * @param {object} template a template definition
   */
  writeTemplateDriven(summary, template) {
    // create config-defined buckets
    const buckets = {};
    const rawBuckets = {};
    const {metrics, meta} = summary;

    // for each collected metric
    for (const [key, timesByStatus] of metrics) {
      // get the already parsed items
      const {method, path} = meta.keyToProperties[key];
      // now for each config-defined bucket
      let matched = false;
      for (const bucket of template.routes) {
        if (bucket.method === method) {
          if (bucket.startsWith && path.startsWith(bucket.startsWith)) {
            // store in bucket
            this.saveMatch(buckets, bucket.name, timesByStatus);
            matched = true;
          } else if (bucket.regex) {
            const m = path.match(bucket.regex);
            if (m) {
              // store in bucket
              this.saveMatch(buckets, bucket.name, timesByStatus);
              matched = true;
            } else if (bucket.pattern && path === bucket.pattern) {
              this.saveMatch(buckets, bucket.name, timesByStatus);
              matched = true;
            } else {
              // hmm. either at least one match type must be present. and that
              // should have been verified already.
            }
          }
        }
      }
      if (!matched) {
        // it didn't match any of the template-defined route buckets.
        // put it in its own bucket, like default behavior
        this.saveMatch(rawBuckets, key, timesByStatus);
      }
    }

    // order keys so the template-named buckets come before the default-named
    // buckets (which are really just the raw routes).
    for (const key in rawBuckets) {
      buckets[key] = rawBuckets[key];
    }

    for (const bucketName in buckets) {
      const timesByStatus = buckets[bucketName];
      for (const status in timesByStatus) {
        const lowToHigh = (a, b) => a === b ? 0 : a < b ? -1 : 1;
        const times = timesByStatus[status].sort(lowToHigh);
        const {n, mean, stddev} = stats(times);
        const percentiles = percentile(this.percentiles, times);
        const line = [
          bucketName, status, n, f2(mean), f2(stddev), ...percentiles
        ].join(',');
        this.stream.write(`${line}\n`);
      }
    }
  }

  saveMatch(buckets, name, timesByStatus) {
    let bucket = buckets[name];
    if (!bucket) {
      bucket = buckets[name] = {};
    }
    for (const status in timesByStatus) {
      if (!bucket[status]) {
        bucket[status] = timesByStatus[status].slice();
      } else {
        bucket[status] = bucket[status].concat(timesByStatus[status]);
      }
    }
  }
}

//
// formatting helpers
//
function f2(n) {
  return n.toFixed(2);
}

function iso(ts) {
  return new Date(ts).toISOString();
}

//
// summarization functions
//
function stats(array) {
  const n = array.length;
  const total = array.reduce((tot, v) => tot + v, 0);
  const mean = total / n;
  const stddev = variance(array) ** 0.5;

  return {n, total, mean, stddev};
}

function mean(array) {
  return array.reduce((tot, v) => tot + v, 0) / array.length;
}

function variance(array) {
  const average = mean(array);
  return mean(array.map((num) => (num - average) ** 2));
}


function percentile(percentiles, array) {
  return percentiles.map(p => pctile(p, array));
}

function pctile(p, list) {
  if (p === 0) return list[0];
  return list[Math.ceil(list.length * p) - 1];
}

module.exports = Reporter;
