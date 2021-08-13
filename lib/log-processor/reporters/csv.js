'use strict';

const percentiles = [0.50, 0.70, 0.80, 0.90, 0.95];

function report(stream, summary, meta, options = {}) {
  writeInformation(summary);

  // sort the metrics so the percentiles work correctly.
  summary.metrics.sort((a, b) => a === b ? 0 : a[0] < b[0] ? -1 : 1);

  stream.write(`route, status, n, mean, stddev, percentiles: ${percentiles.join(', ')}\n`);
  // route, status, n, ...percentiles
  if (!options.template) {
    writeSimple(stream, summary);
  } else {
    writeConfigDriven(stream, summary, meta, options.template);
  }
}

function writeInformation(s) {
  /* eslint-disable no-console */
  const lc = s.lastLine - s.firstLine + 1;
  console.log(`[read ${lc} lines (${s.byteCount} bytes)]`);
  console.log(`[start ${iso(s.firstTimestamp)}, end ${iso(s.lastTimestamp)}]`);
  const rc = s.metrics.length;
  let totalObs = 0;
  for (const [, timesByStatus] of s.metrics) {
    for (const status in timesByStatus) {
      totalObs += timesByStatus[status].length;
    }
  }
  console.log(`[total time measurements ${totalObs} across ${rc} routes]`);

  // note whether the agent is loaded or not
  for (const p of s.patches) {
    if (!p.entry.name.startsWith('http')) {
      console.log(`[${p.entry.name} loaded]`);
      break;
    }
  }
  /* eslint-enable no-console */
}

function writeSimple(stream, summary) {
  const {metrics} = summary;

  // for each collected metric
  for (const [path, timesByStatus] of metrics) {
    // for each status code
    for (const status in timesByStatus) {
      const lowToHigh = (a, b) => a === b ? 0 : a < b ? -1 : 1;
      const times = timesByStatus[status].sort(lowToHigh);
      const {n, mean, stddev} = stats(times);
      const line = [
        path, status, n, f2(mean), f2(stddev), ...percentile(percentiles, times)
      ].join(',');
      stream.write(`${line}\n`);
    }
  }
}

function writeConfigDriven(stream, summary, meta, template) {
  // create config-defined buckets
  const buckets = {};
  const {metrics} = summary;

  // for each collected metric
  for (const [key, timesByStatus] of metrics) {
    // get the already parsed items
    const {method, path} = meta.keyToProperties[key];
    // now for each config-defined bucket
    let matched = false;
    for (const bucket of template.routes) {
      if (bucket.method === method) {
        if (bucket.pattern && path === bucket.pattern) {
          // store in bucket
          saveMatch(buckets, bucket.name, timesByStatus);
          matched = true;
        } else if (bucket.regex) {
          const m = path.match(bucket.regex);
          if (m) {
            // store in bucket
            saveMatch(buckets, bucket.name, timesByStatus);
            matched = true;
          } else {
            // hmm. either pattern or regex must be present.
          }
        }
      }
    }
    if (!matched) {
      // it didn't match any of the template-defined route buckets.
      // put it in its own bucket, like default behavior
      saveMatch(buckets, key, timesByStatus);
    }
  }

  for (const bucketName in buckets) {
    const timesByStatus = buckets[bucketName];
    for (const status in timesByStatus) {
      const lowToHigh = (a, b) => a === b ? 0 : a < b ? -1 : 1;
      const times = timesByStatus[status].sort(lowToHigh);
      const {n, mean, stddev} = stats(times);
      const line = [
        bucketName, status, n, f2(mean), f2(stddev), ...percentile(percentiles, times)
      ].join(',');
      stream.write(`${line}\n`);
    }
  }
}

function saveMatch(buckets, name, timesByStatus) {
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

/* https://statisticsbyjim.com/basics/percentiles/
Calculate the rank to use for the percentile. Use: rank = p(n+1), where p = the percentile and n = the sample size. For our example, to find the rank for the 70th percentile, we take 0.7*(11 + 1) = 8.4.
If the rank in step 1 is an integer, find the data value that corresponds to that rank and use it for the percentile.
If the rank is not an integer, you need to interpolate between the two closest observations. For our example, 8.4 falls between 8 and 9, which corresponds to the data values of 35 and 40.
Take the difference between these two observations and multiply it by the fractional portion of the rank. For our example, this is: (40 – 35)0.4 = 2.
Take the lower-ranked value in step 3 and add the value from step 4 to obtain the interpolated value for the percentile. For our example, that value is 35 + 2 = 37.
*/

module.exports = {
  report
};
