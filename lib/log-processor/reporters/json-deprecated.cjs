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
    // don't output lines in the JSON summary. they were added so that
    // the log-processor/utils/ could replace the legacy code.
    const logLines = this.runSummaries.map(s => {
      const lines = s.lines;
      delete s.lines;
      return lines;
    });
    const summaries = JSON.stringify(this.runSummaries, null, 2);
    this.stream.write(summaries);
    // restore the lines
    for (let i = 0; i < this.runSummaries.length; i++) {
      this.runSummaries[i].lines = logLines[i];
    }
    return new Promise(resolve => {
      this.stream.write('\n', resolve);
    });
  }
}

module.exports = Reporter;
