'use strict';

const perf_hooks = require('perf_hooks');
const {PerformanceObserver: PerfObserver, monitorEventLoopDelay} = perf_hooks;

// setup interval for observing eventloop delay and gc counts
// param: interval (1 second min?, don't allow too often).
// param: eventloop timer resolution (undocumented option, 20ms?) (10 is node default)
// returns: handle?

const defaultOpts = {
  gcCallback: undefined,
  elCallback: undefined,
  eventloopResolution: 20,
  histogramPercentiles: [50, 75, 90, 97.5, 99],
};

class TimeSeries {
  constructor(ms, opts) {
    this.ms = ms;
    this.opts = Object.assign({}, defaultOpts, opts);

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

    // interval handler lightly formats collected stats.
    const intervalHandler = () => {
      if (this.gcCallback) {
        this.gcCallback({count: this.gcCount, totalTime: this.gcTotalTime});
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
          this.gcTotalTime += entry.duration;
        }
      }
    });

    return observer;
  }

  enableEventloopMonitoring(options) {
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
  [perf_hooks.constants.NODE_PERFORMANCE_GC_MAJOR]: 'major',      // 2
  [perf_hooks.constants.NODE_PERFORMANCE_GC_MINOR]: 'minor',      // 1
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
