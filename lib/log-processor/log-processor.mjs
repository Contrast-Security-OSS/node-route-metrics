
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

  get lineCount() {
    return this.lines.length;
  }

  /**
   * read the log file and parse it. each log line must be a valid logObject
   * with a timestamp, type, and entry.
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

    this.charCount = this.inputStream.bytesRead;
    this.summarize();

  }

  /**
   * Prepare information to generate a summary of what's in the log file.
   */
  async summarize() {
    //
    // gather information that is specific to the file
    //
    const overallInfo = {
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
}
