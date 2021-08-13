'use strict';

const fs = require('fs');

class Writer {
  constructor(filename, options = {}) {
    this.filename = filename;
    this.options = options;

    this.waitCount = 0;
    this.writeCount = 0;

    this.stream = fs.createWriteStream(filename, options.streamOptions);
    this.stream.on('error', e => this.handleStreamError(e));
    this.stream.on('drain', () => this.waitForDrain = false);
  }

  write(type, stringOrObject) {
    this.writeCount += 1;

    if (this.waitForDrain) {
      this.waitCount += 1;
      return 0;
    }

    const entry = {ts: Date.now(), type, entry: stringOrObject};
    const line = `${JSON.stringify(entry)}\n`;

    this._rawWrite(line);

    return line.length;
  }

  _rawWrite(bytes) {
    // do we need to wait for drain?
    if (!this.stream.write(bytes)) {
      this.waitForDrain = true;
    }
  }

  getStream() {
    return this.stream;
  }

  getDrainState() {
    return this.waitForDrain ? 'wait' : 'ready';
  }

  getMetrics() {
    return {writeCount: this.writeCount, waitCount: this.waitCount};
  }

  clearMetrics() {
    this.writeCount = this.waitCount = 0;
  }

  handleStreamError(e) {
    if (e.code === 'EACCES') {
      throw new Error(`route-metrics: ${e.message}`);
    }
    // eslint-disable-next-line no-console
    console.error('route-metrics writer:', e.message);
  }
}

module.exports = Writer;
