'use strict';

const fs = require('fs');

/**
 * @classdesc Opens the specified filename as a write stream and
 * provides methods to write and access write stats.
 *
 * @class
 * @param {string} filename the file path to open as a write stream
 * @param {object} options none currently implemented
 */
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

  /**
   * @param {string} type the type property of the json object to be written
   * @param {string|object} entry value of the entry property
   * @returns {integer} the number of characters written.
   */
  write(type, entry) {
    this.writeCount += 1;

    if (this.waitForDrain) {
      this.waitCount += 1;
      return 0;
    }

    const entryObj = {ts: Date.now(), type, entry};
    const line = `${JSON.stringify(entryObj)}\n`;

    this._rawWrite(line);

    return line.length;
  }

  _rawWrite(bytes) {
    // do we need to wait for drain?
    if (!this.stream.write(bytes)) {
      this.waitForDrain = true;
    }
  }

  /**
   * @returns {object} the write stream
   */
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

  /**
   * handleStreamError is the stream's on('error') handler. EACCES is checked
   * because if the stream is not writable there is no point in continuing.
   *
   * @param {object} e the emitted error
   */
  handleStreamError(e) {
    if (e.code === 'EACCES') {
      throw new Error(`route-metrics: ${e.message}`);
    }
    // eslint-disable-next-line no-console
    console.error('route-metrics writer:', e.message);
  }
}

module.exports = Writer;
