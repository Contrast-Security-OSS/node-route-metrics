'use strict';

const fs = require('node:fs');
const {threadId} = require('node:worker_threads');

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
    this.charsWritten = 0;
    this.waitingForDrain = 0;
    this.maxWaitingForDrain = 0;

    this.outputStream = fs.createWriteStream(filename, options.streamOptions);
    this.outputStream.on('error', e => this.handleStreamError(e));
    this.outputStream.on('drain', () => this.waitForDrain = false);
  }

  /**
   * @param {object} {type, tid=threadId, ts=Date.now()} common properties
   * @param {string|object} entry property value
   * @returns {integer} the number of characters written.
   */
  async write(common, entry) {
    this.writeCount += 1;

    // wait for drain if needed. this is not a one-size-fits-all solution; the
    // loader thread can submit entries while this re-entrant code is waiting
    // for the 'drain' event. if the loader thread submits entrie while this is
    // waiting, many listeners can be added, exceeding the max listeners limit.
    // that results in promises that won't resolve.
    //
    //
    // when the 'drain' event occurs, the waiters should be notified in the
    // order they waited, so the log should be in order. but if highWaterMark
    // is not large enough for bursts of entries, log data will be lost waiting
    // on never-to-be-resolved promises.
    while (this.waitForDrain) {
      this.waitCount += 1;
      this.waitingForDrain += 1;
      this.maxWaitingForDrain = Math.max(this.maxWaitingForDrain, this.waitingForDrain);
      await new Promise(resolve => this.outputStream.once('drain', resolve));
      this.waitingForDrain -= 1;
    }

    const {type} = common;
    const tid = common.tid ?? threadId;
    const ts = common.ts ?? Date.now();

    const entryObj = {ts, type, tid, entry};
    const line = `${JSON.stringify(entryObj)}\n`;

    this._rawWrite(line);

    return line.length;
  }

  _rawWrite(chars) {
    this.totalCharsWritten += chars.length;
    // do we need to wait for drain?
    if (!this.outputStream.write(chars)) {
      this.waitForDrain = true;
    }
  }

  /**
   * @returns {object} the write stream
   */
  getStream() {
    return this.outputStream;
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
