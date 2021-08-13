'use strict';

const {reader} = require('./reader');

class LogProcessor {
  constructor(file, reporter, output, options = {}) {
    this.file = file;
    this.reporter = reporter;
    this.output = output;
    this.options = options;

    this.state = 'need-header';
    this.byteCount = 0;
    this.lineCount = 0;
    this.errors = new Map();

    // the following are to allow the file to be written in append
    // mode at some point in the future. at this time there can be
    // only one summary per file because the file is opened with the
    // 'w' flag.
    this.summary = this.makeSummary();
    this.summaries = [this.summary];
  }

  makeSummary() {
    return {
      header: undefined,
      metrics: new Map(),
      patches: new Set(),
      unknown: [],
      firstTimestamp: undefined,
      lastTimestamp: undefined,
      firstLine: undefined,
      lastLine: undefined,
    };
  }

  async read() {
    const processLine = line => this.processLine(line);
    return reader({file: this.file, processLine})
      .then(r => {
        this.byteCount = r.byteCount;
        return r;
      });
  }

  processLine(line) {
    this.lineCount += 1;
    let parsed;

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

    const {summary} = this;

    if (this.state === 'need-header') {
      if (parsed.type === 'header') {
        this.state = 'have-header';
        summary.header = parsed;
        summary.firstLine = this.lineCount;
        summary.firstTimestamp = parsed.ts;
      }
      return;
    }

    if (this.state !== 'have-header') {
      throw new Error(`unexpected state ${this.state}`);
    }

    summary.lastTimestamp = parsed.ts;

    if (parsed.type === 'metrics') {
      this.saveMetric(parsed);
      return;
    }

    if (parsed.type === 'patch') {
      this.savePatch(parsed);
      return;
    }

    this.saveUnknownType(parsed);
  }

  summarize() {
    const re = /([^ ]+) https?:\/\/[^/]+(.+)/;
    const meta = {};
    const options = {template: this.options.template};

    const summary = Object.assign({}, this.summary);
    summary.metrics = [...summary.metrics.entries()];
    summary.patches = [...summary.patches];
    summary.lastLine = this.lineCount;
    summary.byteCount = this.byteCount;

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
