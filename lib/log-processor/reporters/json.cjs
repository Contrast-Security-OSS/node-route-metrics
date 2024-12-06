'use strict';

const BaseReporter = require('./base-reporter.cjs');

class Reporter extends BaseReporter {
  constructor(stream, overallInfo, options) {
    super(stream, overallInfo, options);
  }

  reportOverall() {
    // do nothing
  }

  async report() {
    const summaries = JSON.stringify(this.runSummaries, null, 2);
    this.stream.write(summaries);
    return new Promise(resolve => {
      this.stream.write('\n', resolve);
    });
  }
}

module.exports = Reporter;
