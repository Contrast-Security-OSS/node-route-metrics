'use strict';

const reader = require('./reader');

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
class LogProcessor {
  constructor(file, reporter, stream, options = {}) {
    this.file = file;
    this.reporter = reporter;
    this.stream = stream;
    this.options = options;

    this.state = 'need-header';
    this.charCount = 0;
    this.lineCount = 0;
    this.errors = new Map();
    this.timeSeries = {};

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
    this.summary = undefined;
    this.summaries = [];
  }

  /**
   * make a new summary object
   *
   * @param {object} header a log file entry of type 'header'
   * @returns {object}
   */
  makeSummary(header) {
    return {
      header,
      metrics: new Map(),
      patches: new Set(),
      unknown: [],
      timeSeries: this.timeSeries,
      firstTimestamp: header.ts,
      lastTimestamp: undefined,
      firstLine: this.lineCount,
      lastLine: undefined,
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
   * line of type 'header' and ends with the next type 'header' or EOF.
   *
   * it is not currently possible for multiple headers to be in one file as
   * the file is opened with the 'w' flag, but it should work now.
   */
  async processFile() {

    const lines = reader({file: this.file});
    for await (const line of lines) {
      // EOF?
      if (line === null) {
        this.finalizeSummary();
        // return the character count
        return (await lines.next()).value;
      }

      this.lineCount += 1;
      let parsed;


      // is it a valid line?
      try {
        parsed = JSON.parse(line);
        if (!parsed.ts || !parsed.type || !parsed.entry) {
          throw new Error('invalid log entry');
        }
      } catch (e) {
        if (!this.errors.has(e.message)) {
          this.errors.set(e.message, [this.lineCount]);
        } else {
          this.errors.get(e.message).push(this.lineCount);
        }
      }

      this.lastTimestamp = parsed.ts;

      // is this a header? if so, then if there is an existing header it needs
      // to be finalized.
      if (parsed.type === 'header') {
        if (this.summary) {
          this.finalizeSummary(parsed.type === 'header');
        }
        this.summary = this.makeSummary(parsed);
        this.summaries.push(this.summary);
        continue;
      }

      // routes used to be known as metrics but that was too generic and
      // confusing.
      if (parsed.type === 'route') {
        this.saveRoute(parsed);
        continue;
      }

      if (parsed.type === 'patch') {
        this.savePatch(parsed);
        continue;
      }

      // keep track of known timeseries types that this doesn't process.
      const series = this.timeSeries[parsed.type];
      if (series) {
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
        // add gc info if present; it's the only information that can really be
        // useful after the run has completed.
        if (parsed.type === 'gc') {
          series.gcCount += parsed.entry.count;
          series.gcTime += parsed.entry.totalTime;
        } else if (parsed.type === 'proc') {
          this.timeSeries.proc.cpuUserTotal += parsed.entry.cpuUser;
          this.timeSeries.proc.cpuSystemTotal += parsed.entry.cpuSystem;
        }
        continue;
      }

      this.saveUnknownType(parsed);
    }
  }

  /**
   * Prepare information to generate summaries of what's in the log file.
   */
  async summarize() {
    //
    // gather information that is specific to the file, not each summary
    //
    const overallInfo = {
      runSummaries: this.cloneSummaries(),
      file: this.file,
      linesRead: this.lineCount,
      charCount: this.charCount,
    };

    const reporter = new this.reporter(this.stream, overallInfo);

    return await reporter.report(this.options);
  }

  cloneSummaries() {
    return this.summaries.map(summary => {
      const clone = Object.assign({}, summary);
      clone.metrics = [...summary.metrics.entries()];
      clone.patches = [...summary.patches];
      clone.meta = {keyToProperties: this.makeKeyToProperties(clone)};
      return clone;
    });
  }


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
    for (const [key] of clone.metrics) {
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
  saveRoute(route) {
    const {entry} = route;
    const {statusCode} = entry;
    const key = `${entry.method} ${entry.protocol}://${entry.host}:${entry.port}${entry.url}`;

    let m = this.summary.metrics.get(key);
    if (!m) {
      m = {};
      this.summary.metrics.set(key, m);
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
  savePatch(patch) {
    delete patch.type;
    this.summary.patches.add(patch);
  }

  /**
   * save an unknown line in the unknown array.
   */
  saveUnknownType(unknown) {
    this.summary.unknown.push(unknown);
  }
}

module.exports = LogProcessor;
