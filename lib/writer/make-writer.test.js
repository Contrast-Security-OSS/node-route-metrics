'use strict';

const fsp = require('fs').promises;

const sinon = require('sinon');
const {expect} = require('chai');

const Writer = require('./make-writer');

describe('make-writer tests', function() {
  let filename;
  let writer;
  let stream;
  let sandbox;

  beforeEach(function() {
    filename = this.test.ctx.currentTest.title.replace(/ /g, '-');
    writer = new Writer(filename);
    stream = writer.getStream();
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    return fsp.unlink(filename)
      .catch(e => {
        if (e.code !== 'ENOENT') {
          throw e;
        }
      });
  });

  it('creates a writer', async function() {
    // wait for end on the stream
    await asyncFn(stream);
    const stats = await fsp.stat(filename);
    expect(stats.size).equal(0, 'the file should be empty');
  });

  it('writes objects as timestamped json with a newline', async function() {
    const obj = {this: 'is', a: 'complicated', multi: {level: 'object'}};
    writer.write('test', obj);
    await asyncFn(stream);
    const file = await fsp.readFile(filename, {encoding: 'utf8'});
    const fileObj = JSON.parse(file);
    const expected = {ts: fileObj.ts, type: 'test', entry: obj};
    expect(fileObj).eql(expected);
  });

  it('writes strings as timestamped json with a newline', async function() {
    const string = 'this is a line to write';
    writer.write('test', string);
    await asyncFn(stream);
    const file = await fsp.readFile(filename, {encoding: 'utf8'});
    const fileObj = JSON.parse(file);
    const expected = {ts: fileObj.ts, type: 'test', entry: string};
    expect(fileObj).eql(expected);
  });

  it('waits as needed', async function() {
    const string = '0123456789'.repeat(100000);
    writer.write('test', string);
    // this is the additional data added by writer. the space represents the newline
    // that write() adds to the end of each stringified object.
    const extra = JSON.stringify({ts: Date.now(), type: 'test', entry: ' '});
    expect(stream.writableLength).equal(string.length + extra.length);
    expect(writer.getDrainState()).equal('wait');
    // try writing more bytes
    writer.write('test2', 'x');
    return new Promise((resolve, reject) => {
      stream.on('drain', function() {
        expect(stream.writableLength).equal(0);
        expect(writer.getDrainState()).equal('ready');
        const {writeCount, waitCount} = writer.getMetrics();
        // two attempted writes
        expect(writeCount).equal(2);
        // only the second write failed ('test2', 'x')
        expect(waitCount).equal(1);

        fsp.readFile(filename, {encoding: 'utf8'})
          .then(file => {
            const obj = JSON.parse(file);
            expect(obj).property('entry').a('string');
            expect(obj.entry).equal(string);
            resolve();
          });
      });
    });
  });


  it('clears metrics', function() {
    const string = '1234567';
    writer.write('test', string);
    let {writeCount, waitCount} = writer.getMetrics();
    expect(writeCount).equal(1);
    expect(waitCount).equal(0);
    writer.clearMetrics();
    ({writeCount, waitCount} = writer.getMetrics());
    expect(writeCount).equal(0);
    expect(waitCount).equal(0);
  });

  it('handles stream errors', function(done) {
    const e = new Error('write after end');
    e.code = 'ERR_STREAM_WRITE_AFTER_END';
    const stub = sandbox.stub(writer, 'handleStreamError');
    stub.callsFake(function(...args) {
      // just eat the message so no console output
    });

    stream.on('finish', function() {
      writer.write('after-end', 'something');
      // give time for the error to be emitted. (prior to node 13.11.0
      // the wait was not necessary).
      setTimeout(function() {
        expect(stub.callCount).equal(1, 'handleStreamError not called');
        expect(stub.args[0][0]).property('code', e.code);
        expect(stub.args[0][0]).property('message', e.message);
        done();
      }, 10);
    });

    stream.end();
  });

  function asyncFn(stream, fn = 'end') {
    return new Promise((resolve, reject) => {
      stream[fn](e => {
        if (e) {
          reject(e);
        } else {
          resolve();
        }
      });
    });
  }
});
