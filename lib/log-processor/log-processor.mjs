
import readline from 'node:readline';
import fs from 'node:fs';

import RouteMetricsResults from '@contrast/route-metrics-utils';

/**
 * @classdesc LogProcessor implements an instance that can read, parse, and
 * organize the parsed data for display.
 *
 * @class
 * @param {string} file the log file to process
 * @param {object} reporter the report function is used for formatting
 * @param {object} stream a writable stream to be used for output
 * @param {object} [options={}] options
 * @param {object} options.template a route grouping template - see
 *   log-processor-output-template.js
 */
export default class LogProcessor {
  constructor(file, reporter, stream, options = {}) {
    this.file = file;
    this.inputStream = fs.createReadStream(file, {encoding: 'utf8'});
    this.reporter = reporter;
    this.outputStream = stream;
    this.options = options;

    this.charCount = 0;
    this.lines = [];
    this.errors = new Map();
    this.timeSeries = {};
    this.rmr = new RouteMetricsResults();

    this.timeSeries.proc = {
      count: 0,
      firstTime: 0,     // timestamp of first entry
      lastTime: 0,
      first: undefined, // first entry
      last: undefined,  // last entry
      cpuUserTotal: 0,  // µsec
      cpuSystemTotal: 0, // µsec
    };
    this.timeSeries.gc = {
      count: 0,
      firstTime: 0,
      lastTime: 0,
      first: undefined,
      last: undefined,
      gcCount: 0,
      gcTime: 0,
    };
    this.timeSeries.eventloop = {
      count: 0,
      firstTime: 0,
      lastTime: 0,
      first: undefined,
      last: undefined,
    };

    // the following are to allow the file to be written in append
    // mode at some point in the future. at this time there can be
    // only one summary per file because the file is opened with the
    // 'w' flag.
    //
    // summary was the first implementation that extracted data from the log
    // file. it has been replaced by route-metrics-results but is kept here
    // for testing purposes. the code needs to be refactored to move it out
    // of this file and into either the test or a parallel implementation to
    // route-metrics-results.
    //
    this.summary = undefined;
  }

  /**
   * make a new summary object
   *
   * @param {object} header a log file entry of type 'header'
   * @returns {object}
   */
  makeSummary() {
    return {
      header: this.rmr.header.logObjects[0],
      routes: new Map(),
      patches: new Set(),
      statuses: [],
      unknown: [],
      timeSeries: this.timeSeries,
      firstTimestamp: this.rmr.earliestTimestamp,
      lastTimestamp: this.rmr.latestTimestamp,
    };
  }

  /**
   * finalize a summary by updating missing data
   *
   * @param {boolean} [newHeader = false] true if a new header ended the current summary
   */
  finalizeSummary(newHeader) {
    this.summary.lastTimestamp = this.lastTimestamp;
    this.summary.lastLine = this.lineCount;
    if (newHeader) {
      this.summary.lastLine -= 1;
    }
    // calculate a CPU percentage presuming that there is only 1 CPU.
    if (this.summary.timeSeries.proc.lastTime > this.summary.timeSeries.proc.firstTime) {
      const proc = this.summary.timeSeries.proc;
      const elapsedMicros = (proc.last.ts - proc.first.ts) * 1000;
      proc.cpuUserPercent = proc.cpuUserTotal / elapsedMicros;
      proc.cpuSystemPercent = proc.cpuSystemTotal / elapsedMicros;
    }
    const rmr = new RouteMetricsResults();
    rmr.indexArray(this.summary.lines);
    this.routeMetricsResults.push(rmr);
  }

  get lineCount() {
    return this.lines.length;
  }

  /**
   * this function is the way the user of the class kicks off processing.
   * when it has completed then summarize() can be called.
   */
  async read() {
    return this.processFile()
      .then(r => {
        this.charCount = r;
        return this.summaries.length;
      });
  }

  /**
   * read the log file and parse summaries. each summary starts with a log
   * line of type 'header' and ends with EOF.
   */
  async processFile() {
    const lines = readline.createInterface({
      input: this.inputStream,
      crlfDelay: Infinity,
    });

    for await (const line of lines) {
      // is it a valid line?
      try {
        const parsed = JSON.parse(line);
        if (!parsed.ts || !parsed.type || !parsed.entry) {
          throw new Error('invalid log entry');
        }
        //this.lineCount += 1;
        //this.addParsedLine(parsed);
        this.lines.push(parsed);
      } catch (e) {
        if (!this.errors.has(e.message)) {
          this.errors.set(e.message, [this.lineCount]);
        } else {
          this.errors.get(e.message).push(this.lineCount);
        }
        continue;
      }
    }

    this.rmr.indexArray(this.lines);

    this.summary = this.makeSummary();

    // all done with the file. finalize the summary. this was pulled from
    // finalize() because we don't ever want to support appending to the
    // log file - it's just unneeded complexity. but we're now using rmr
    // to fill in this.summary.
    // this.summary.lastTimestamp = this.rmr.latestTimestamp;
    // this.summary.lastLine = this.lineCount;

    // divide by 100 because rmr were real percents while summary was fractions
    // const percents = this.rmr.proc.cpuPercents;
    // this.summary.timeSeries.proc.cpuUserPercent = percents.user / 100;
    // this.summary.timeSeries.proc.cpuSystemPercent = percents.system / 100;
    this.charCount = this.inputStream.bytesRead;
    this.summarize();

  }

  addParsedLine(parsed) {
    this.lastTimestamp = parsed.ts;

    // is this a header? if so, then if there is an existing header it needs
    // to be finalized.
    if (parsed.type === 'header') {
      if (this.summary) {
        this.finalizeSummary(true);
      }
      this.summary = this.makeSummary(parsed);
      this.summaries.push(this.summary);
      return;
    }

    if (parsed.type === 'route') {
      this.addRoute(parsed);
    } else if (parsed.type === 'proc') {
      this.addProc(parsed);
    } else if (parsed.type === 'gc') {
      this.addGc(parsed);
    } else if (parsed.type === 'eventloop') {
      this.addEventloop(parsed);
    } else if (parsed.type === 'patch') {
      this.addPatch(parsed);
    } else if (parsed.type === 'status') {
      this.addStatus(parsed);
    } else {
      this.saveUnknownType(parsed);
    }

    // add the parsed line to the array used by the utils/ implementation.
    this.summary.lines.push(parsed);
  }

  /**
   * Prepare information to generate summaries of what's in the log file.
   */
  async summarize() {
    //
    // gather information that is specific to the file, not each summary
    //
    const overallInfo = {
      // not sure why cloning makes sense here
      //runSummaries: this.cloneSummaries(),
      rmr: this.rmr,
      file: this.file,
      linesRead: this.lineCount,
      charCount: this.charCount,
    };

    const reporter = new this.reporter(this.outputStream, overallInfo);

    const result = await reporter.report(this.options);

    return new Promise(resolve => {
      this.outputStream.end(() => resolve(result));
    });
  }

  // cloneSummaries() {
  //   return this.summaries.map(summary => {
  //     const clone = Object.assign({}, summary);
  //     clone.routes = [...summary.routes.entries()];
  //     clone.patches = [...summary.patches];
  //     clone.meta = {keyToProperties: this.makeKeyToProperties(clone)};
  //     return clone;
  //   });
  // }


  /**
   * Generate information so a reporter doesn't need to understand the key
   * structure of the metrics.
   *
   * @param {object} clone a run summary as created by cloneSummaries()
   */
  makeKeyToProperties(clone) {
    //
    // decode the metrics into an index for easier filtering. the metrics are keyed
    // by a string like "GET https://x.y.com:443/path". this creates a parallel map
    // indexed by the same key with a value of {method: "GET", path: "/path"} so that
    // those do not need to be extracted for matching against template buckets.
    //
    const re = /([^ ]+) https?:\/\/[^/]+(.+)/;
    const keyToProperties = {};
    for (const [key] of clone.routes) {
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

  /**
   * save a route in the metrics map. the key is constructed from the entry
   * properties and the value is an object where each statusCode key stores
   * an array of times. (routes used to be known as metrics.)
   *
   * @param {object} route
   */
  addRoute(route) {
    const {entry} = route;
    const {statusCode} = entry;
    const key = `${entry.method} ${entry.protocol}://${entry.host}:${entry.port}${entry.url}`;

    let m = this.summary.routes.get(key);
    if (!m) {
      m = {};
      this.summary.routes.set(key, m);
    }
    let observations = m[statusCode];
    if (!observations) {
      observations = m[statusCode] = [];
    }
    observations.push(entry.et);
  }

  /**
   * save a patch in the patch set.
   */
  addPatch(parsed) {
    this.summary.patches.add(parsed);
  }

  addProc(parsed) {
    this.addTimeSeries(parsed);
    this.timeSeries.proc.cpuUserTotal += parsed.entry.cpuUser;
    this.timeSeries.proc.cpuSystemTotal += parsed.entry.cpuSystem;
  }
  addGc(parsed) {
    this.addTimeSeries(parsed);
    this.timeSeries.gc.gcCount += parsed.entry.count;
    this.timeSeries.gc.gcTime += parsed.entry.totalTime;
  }

  addEventloop(parsed) {
    this.addTimeSeries(parsed);
  }

  addTimeSeries(parsed) {
    // keep track of known timeseries types that this doesn't process.
    const series = this.timeSeries[parsed.type];
    if (!series) {
      throw new Error(`unknown time series type: ${parsed.type}`);
    }
    series.count += 1;
    if (series.firstTime === 0) {
      series.firstTime = parsed.ts;
      series.lastTime = parsed.ts;
      series.first = parsed;
      series.last = parsed;
    } else if (parsed.ts > series.lastTime) {
      series.lastTime = parsed.ts;
      series.last = parsed;
    }
  }

  addStatus(parsed) {
    this.summary.statuses.push(parsed);
  }

  /**
   * save an unknown line in the unknown array.
   */
  saveUnknownType(unknown) {
    this.summary.unknown.push(unknown);
  }
}
