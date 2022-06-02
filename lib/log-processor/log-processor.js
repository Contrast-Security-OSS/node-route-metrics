'use strict';

const reader = require('./reader');

const timeSeries = ['gc', 'eventloop', 'proc'];

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
    for (const ts of timeSeries) {
      this.timeSeries[ts] = {count: 0, firstTime: 0, lastTime: 0};
    }

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

      if (parsed.type === 'metrics') {
        this.saveMetric(parsed);
        continue;
      }

      if (parsed.type === 'patch') {
        this.savePatch(parsed);
        continue;
      }

      // keep track of known timeseries types that this doesn't process.
      if (timeSeries.includes(parsed.type)) {
        const series = this.timeSeries[parsed.type];
        series.count += 1;
        const now = Date.now();
        if (series.firstTime === 0) {
          series.firstTime = now;
          series.lastTime = now;
        } else if (now > series.lastTime) {
          series.lastTime = now;
        }
        // add gc info if present; it's the only information that can really be
        // useful after the run has completed.
        if (parsed.type === 'gc') {
          if (series.gcCount === undefined) {
            series.gcCount = 0;
            series.gcTime = 0;
          }
          series.gcCount += parsed.entry.count;
          series.gcTime += parsed.entry.totalTime;
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
   * save a metric in the metrics map. the key is constructed from the entry
   * properties and the value is an object where each statusCode key stores
   * an array of times.
   *
   * @param {object} metric
   */
  saveMetric(metric) {
    const {entry} = metric;
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
