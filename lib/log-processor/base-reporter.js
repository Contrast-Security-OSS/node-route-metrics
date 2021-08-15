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
  constructor(stream, overallInfo, options) {
    this.stream = stream;
    this.overallInfo = overallInfo;
    this.options = options;

    this.runSummaries = this.overallInfo.runSummaries;
  }

  /**
   * function to report information that pertains to the entire file
   * that was read.
   */
  reportOverall() {
    const count = this.runSummaries.length;
    const {file, linesRead, charCount} = this.overallInfo;
    const yIes = count === 1 ? 'summary' : 'summaries';
    // eslint-disable-next-line no-console
    console.log(`[[read ${count} ${yIes} from ${linesRead} lines (${charCount} chars) in ${file}]]\n`);
  }

  report() {
    throw new Error('report must be implemented by BaseReporter subclasses');
  }
}

module.exports = BaseReporter;
