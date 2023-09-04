'use strict';

const perf_hooks = require('perf_hooks');
const {PerformanceObserver: PerfObserver, monitorEventLoopDelay} = perf_hooks;

const WeightedEMA = require('./ema');
const emaAlphaForCpu = 0.1;
const emaAlphaForMem = 0.2;   // maybe even higher?

const defaultOpts = {
  tsCallback: () => undefined,
  gcCallback: undefined,
  elCallback: undefined,
  eventloopResolution: 20,  // sampling rate in ms
  histogramPercentiles: [50, 75, 90, 95, 99],
};

// param: interval (1 second min?, don't allow too often).
// param: eventloop timer resolution (undocumented option, 20ms?) (10 is node default)
// returns: handle?
class TimeSeries {
  /**
   * @param {number} ms the number of milliseconds for the interval timer. gc and
   * eventloop stats are collected on this interval.
   * @param {object} opts options as follows
   * - tsCallback() called for the cpu and memory stats on the `ms` interval.
   * - gcCallback() if provided, enables gc time-series metrics, called on `ms` interval.
   * - elCallback() if provided, enables eventloop time-series metrics, ditto
   * - histogramPercentiles eventloop histogram percentiles reported
   */
  constructor(ms, opts) {
    this.ms = ms;
    this.opts = Object.assign({}, defaultOpts, opts);

    //
    // time-series setup.
    //
    this.tsCallback = this.opts.tsCallback;

    // don't do garbage collection or eventloop lag monitoring unless requested.
    // they are both relatively expensive operations.
    if (this.opts.gcCallback) {
      this.observer = this.setupPerfObserver();
      this.gcCallback = this.opts.gcCallback;
    }
    if (this.opts.elCallback) {
      const options = {resolution: this.opts.eventloopResolution};
      this.eventloopHistogram = this.enableEventloopMonitoring(options);
      this.elCallback = this.opts.elCallback;
    }

    if (this.observer) {
      this.gcCount = 0;
      this.gcTotalTime = 0;
      this.observer.observe({entryTypes: ['measure', 'gc'], buffered: true});
    }
    if (this.eventloopHistogram) {
      this.percentiles = this.opts.histogramPercentiles;
      this.eventloopHistogram.enable();
    }

    this.prevCpu = process.cpuUsage();
    this.cpuUserEMA = new WeightedEMA(emaAlphaForCpu, this.prevCpu.user);
    this.cpuSystemEMA = new WeightedEMA(emaAlphaForCpu, this.prevCpu.system);

    const memoryUsage = process.memoryUsage();
    // rss and heapTotal are just reported as their current values but heapUsed
    // and external are averaged.
    this.memHeapUsedEMA = new WeightedEMA(emaAlphaForMem, memoryUsage.heapUsed);
    this.memExternalEMA = new WeightedEMA(emaAlphaForMem, memoryUsage.external);

    //
    // interval handler lightly formats collected stats.
    //
    const intervalHandler = () => {
      if (this.gcCallback) {
        // have any garbage collections occurred since the last interval?
        if (this.gcCount) {
          this.gcCallback({count: this.gcCount, totalTime: this.gcTotalTime});
          this.gcCount = 0;
          this.gcTotalTime = 0;
        }
      }

      if (this.elCallback) {
        // why not just use eventloopHistogram.percentiles? because it does not
        // return consistent percentiles.
        const percents = {};
        for (const pc of this.percentiles) {
          percents[pc] = this.eventloopHistogram.percentile(pc);
        }
        this.elCallback(percents);
      }

      // get cpu usage and calculate weighted moving averages.
      const cpu = process.cpuUsage();
      const cpuUserAvg = this.cpuUserEMA.update(cpu.user - this.prevCpu.user);
      const cpuSystemAvg = this.cpuSystemEMA.update(cpu.system - this.prevCpu.system);
      this.prevCpu = cpu;

      // get memory usage
      // this should not be called very often as it's expensive.
      // https://nodejs.org/api/process.html#processmemoryusagerss
      // it's also not particularly useful except 1) to compare with/without
      // an agent and 2) observe a memory leak. neither of those requires
      // high resolution observations.
      const mem = process.memoryUsage();
      const cpuAndMem = {
        cpuUserAvg,
        cpuSystemAvg,
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
        arrayBuffers: mem.arrayBuffers,
      };

      this.tsCallback(cpuAndMem);
    };

    this.interval = setInterval(intervalHandler, this.ms);
  }

  setupPerfObserver() {
    const observer = new PerfObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        if (entry.entryType === 'gc') {
          if (this.verbose) {
            // node 16 deprecated these in entry and added them to detail
            const {kind, flags} = entry.detail ? entry.detail : entry;
            // eslint-disable-next-line no-console
            console.log(`perf gc: ${entry.duration} (${gcTypes[kind]}) flags: ${flags}`);
          }
          this.gcCount += 1;
          // duration is in milliseconds
          this.gcTotalTime += entry.duration;
        }
      }
    });

    return observer;
  }

  enableEventloopMonitoring(options) {
    // eventloop delay is in nanoseconds
    return perf_hooks.monitorEventLoopDelay(options);
  }

  disable() {
    clearInterval(this.interval);
  }

  setupEventloopMonitoring() {
    // histogram reports nanosecs
    const histogram = monitorEventLoopDelay({resolution: this.eventloopResolution});
    return histogram;
  }

}

const gcTypes = {
  [perf_hooks.constants.NODE_PERFORMANCE_GC_MINOR]: 'minor',      // 1
  [perf_hooks.constants.NODE_PERFORMANCE_GC_MAJOR]: 'major',      // 2
  [perf_hooks.constants.NODE_PERFORMANCE_GC_INCREMENTAL]: 'incr', // 4
  [perf_hooks.constants.NODE_PERFORMANCE_GC_WEAKCB]: 'weak',      // 8
};

module.exports = TimeSeries;

if (require.main === module) {
  const thing = new TimeSeries(1000, {gc: false});

  setTimeout(function() {
    thing.disable();
  }, 2500);
}
