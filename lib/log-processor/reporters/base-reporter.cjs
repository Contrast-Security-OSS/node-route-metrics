'use strict';

/**
 * @classdesc Implement the base functions for reporters.
 *
 * @class BaseReporter
 *
 * @param {object} stream the stream to write the report to
 * @param {object} overallInfo details information about the
 * @param {object} meta meta information about the summary
 * @param {object} options
 *
 */
class BaseReporter {
  constructor(outputStream, overallInfo, options) {
    this.outputStream = outputStream;

    this.file = overallInfo.file;
    this.linesRead = overallInfo.linesRead;
    this.charCount = overallInfo.charCount;
    this.rmr = overallInfo.rmr;

    this.options = options;

    this.isStdout = outputStream.fd === process.stdout.fd;
  }

  /**
   * function to report information that pertains to the entire file
   * that was read.
   */
  reportOverall() {
    //const count = this.runSummaries.length;
    const {file, linesRead, charCount} = this;
    //const yOrIes = count === 1 ? 'summary' : 'summaries';
    // eslint-disable-next-line no-console
    console.log(`[[read 1 summary (${linesRead} lines, ${charCount} chars) from ${file}]]`);
  }

  report() {
    throw new Error('report must be implemented by BaseReporter subclasses');
  }

  getTimeSeriesCount(timeSeries) {
    let count = 0;
    for (const tsKey in ['proc', 'gc', 'eventloop']) {
      count += this.rmr[tsKey].count;
    }
    return count;
  }

  // formatting helpers

  static f2(n) {
    return n.toFixed(2);
  }

  static iso(ts) {
    return new Date(ts).toISOString();
  }

  //
  // stats functions
  //
  static stats(array) {
    const n = array.length;
    const total = array.reduce((tot, v) => tot + v, 0);
    const mean = total / n;
    const stddev = BaseReporter.variance(array) ** 0.5;

    return {n, total, mean, stddev};
  }

  static mean(array) {
    return array.reduce((tot, v) => tot + v, 0) / array.length;
  }

  static variance(array) {
    const average = BaseReporter.mean(array);
    return BaseReporter.mean(array.map((num) => (num - average) ** 2));
  }


  static percentile(percentiles, array) {
    return percentiles.map(p => BaseReporter.pctile(p, array));
  }

  static pctile(p, list) {
    if (p === 0) return list[0];
    return list[Math.ceil(list.length * p) - 1];
  }
}

module.exports = BaseReporter;
