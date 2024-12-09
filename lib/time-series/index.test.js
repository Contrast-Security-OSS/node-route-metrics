'use strict';

const {expect} = require('chai');

const TimeSeries = require('./index');

describe('time-series', function() {
  let timeSeries;
  let interval;

  afterEach(function() {
    if (timeSeries) {
      timeSeries.disable();
      timeSeries = undefined;
    }
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
  });

  it('should construct a TimeSeries object', async function() {
    timeSeries = new TimeSeries(1000);
    expect(timeSeries).exist;
  });

  it('should get cpu and memory callbacks', async function() {
    this.timeout(2500);
    let n = 4;
    let resolve;
    const p = new Promise(r => {resolve = r});
    function tsCallback(tsData) {
      expect(tsData).property('cpuUser').a('number');
      expect(tsData).property('cpuSystem').a('number');
      expect(tsData).property('cpuUserAvg').a('number');
      expect(tsData).property('cpuSystemAvg').a('number');
      expect(tsData).property('rss').a('number');
      expect(tsData).property('heapTotal').a('number');
      expect(tsData).property('heapUsed').a('number');
      expect(tsData).property('external').a('number');
      n -= 1;
      if (n <= 0) {
        resolve();
        return;
      }
    }
    timeSeries = new TimeSeries(250, {tsCallback});

    return p;
  });

  it('should get gc callbacks', async function() {
    // this will fail with a timeout if no garbage is collected.
    this.timeout(2000);
    let garbage;
    // this is a little tricky because node's gc-monitoring only makes callbacks
    // when garbage is collected. it's not possible to know how many will occur
    // in any given time period.
    //
    // do something pointless so gc at least kind of needs to happen. big buffers
    // encourage garbage collection to happen more quickly. i started with 10,000
    // and it took 25 callbacks before there was a gc. 1,000,000 got it in 2 (ymmv).
    interval = setInterval(function() {
      garbage = Buffer.alloc(1000000);
      for (let i = 0; i < 100; i++) {
        garbage[i] = i;
      }
      garbage = undefined;
    }, 10);

    let resolve;
    const p = new Promise(r => {resolve = r});
    function gcCallback(gcData) {
      if (gcData.count > 0) {
        expect(gcData).property('totalTime').gt(0);
        resolve();
      }
    }
    timeSeries = new TimeSeries(250, {gcCallback});

    return p;
  });

  it('should get eventloop callbacks', async function() {
    this.timeout(2000);

    const percentiles = [50, 75, 90, 95, 99];

    let resolve;
    const p = new Promise(r => {resolve = r});

    let count = 2;
    function elCallback(elData) {
      for (const percentile of percentiles) {
        expect(elData).property(percentile).a('number');
      }
      count -= 1;
      if (count <= 0) {
        resolve();
      }
    }
    timeSeries = new TimeSeries(250, {elCallback});

    return p;
  });

  it('should get gc and eventloop callbacks', async function() {
    // this will fail with a timeout if both gc and eventloop callbacks
    // are not .
    this.timeout(2000);
    let garbage;
    // this is a little tricky because node's gc-monitoring only makes callbacks
    // when garbage is collected. it's not possible to know how many will occur
    // in any given time period.
    //
    // do something pointless so gc at least kind of needs to happen. big buffers
    // encourage garbage collection to happen more quickly. i started with 10,000
    // and it took 25 callbacks before there was a gc. 1,000,000 got it in 2 (ymmv).
    interval = setInterval(function() {
      garbage = Buffer.alloc(1000000);
      for (let i = 0; i < 100; i++) {
        garbage[i] = i;
      }
      garbage = undefined;
    }, 10);

    let resolve1;
    const p1 = new Promise(r => {resolve1 = r});

    function gcCallback(gcData) {
      if (gcData.count > 0) {
        expect(gcData).property('totalTime').gt(0);
        resolve1();
      }
    }

    // eventloop
    const percentiles = [50, 75, 90, 95, 99];

    let resolve2;
    const p2 = new Promise(r => {resolve2 = r});

    let count = 2;
    function elCallback(elData) {
      for (const percentile of percentiles) {
        expect(elData).property(percentile).a('number');
      }
      count -= 1;
      if (count <= 0) {
        resolve2();
      }
    }
    timeSeries = new TimeSeries(250, {elCallback, gcCallback});

    return Promise.all([p1, p2]);
  });

  it('allows setting alternate percentiles', async function() {
    const histogramPercentiles = [30, 60, 75, 85, 95];

    let resolve;
    const p = new Promise(r => {resolve = r});

    let count = 2;
    function elCallback(elData) {
      for (const percentile of histogramPercentiles) {
        expect(elData).property(percentile).a('number');
      }
      count -= 1;
      if (count <= 0) {
        resolve();
      }
    }
    timeSeries = new TimeSeries(250, {elCallback, histogramPercentiles});

    return p;
  });
});

// eslint-disable-next-line no-unused-vars
async function wait(n) {
  return new Promise(function(resolve) {
    setTimeout(resolve, n);
  });
}
