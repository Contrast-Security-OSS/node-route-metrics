'use strict';

const getLines = require('./reader');

class LogProcessor {
  constructor(file, reporter, output, options = {}) {
    this.file = file;
    this.reporter = reporter;
    this.output = output;
    this.options = options;

    this.state = 'need-header';
    this.charCount = 0;
    this.lineCount = 0;
    this.errors = new Map();

    // the following are to allow the file to be written in append
    // mode at some point in the future. at this time there can be
    // only one summary per file because the file is opened with the
    // 'w' flag.
    this.summary = undefined;
    this.summaries = [];
  }

  makeSummary(header) {
    return {
      header,
      metrics: new Map(),
      patches: new Set(),
      unknown: [],
      firstTimestamp: header.ts,
      lastTimestamp: undefined,
      firstLine: this.lineCount,
      lastLine: undefined,
    };
  }

  finalizeSummary() {
    this.summary.lastTimestamp = this.lastTimestamp;
    this.summary.lastLine = this.lineCount;
  }

  async read() {
    return this.processFile()
      .then(r => {
        this.charCount = r;
        return this.summary;
      });

  }

  async processFile() {

    const lines = getLines({file: this.file});
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
          this.finalizeSummary();
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

      this.saveUnknownType(parsed);
    }
  }

  summarize() {
    const re = /([^ ]+) https?:\/\/[^/]+(.+)/;
    const meta = {};
    const options = {template: this.options.template};

    const summary = Object.assign({}, this.summary);
    summary.metrics = [...summary.metrics.entries()];
    summary.patches = [...summary.patches];

    // decode the metrics in a meta index for easier filtering
    const keyToProperties = {};
    for (const [key] of summary.metrics) {
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
    meta.keyToProperties = keyToProperties;
    meta.overallInfo = {
      linesRead: this.lineCount,
      charCount: this.charCount,
    };

    this.reporter.report(this.output, summary, meta, options);
  }

  saveMetric(metric) {
    const {entry} = metric;
    const {statusCode} = entry;
    const key = `${entry.method} ${entry.protocol}://${entry.host}:${entry.port}${entry.url}`;

    // ? statusCode
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

  savePatch(patch) {
    delete patch.type;
    this.summary.patches.add(patch);
  }

  saveUnknownType(unknown) {
    this.summary.unknown.push(unknown);
  }
}

module.exports = LogProcessor;
