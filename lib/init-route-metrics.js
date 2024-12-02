'use strict';

const M = require('node:module');
const {isMainThread} = require('node:worker_threads');

module.exports = function initRouteMetrics({type}) {
  //
  // startup code. all code in this file is executed in the main thread.
  // thread-specific code is in other files, e.g., setup-patcher.js.
  //

  const makeHeader = require('./writer/make-header');

  //
  // get the configuration and create the log file writer
  //
  const {config, errors} = require('./config/agent-config').get();
  const Writer = require('./writer/make-writer');
  const writer = new Writer(config.LOG_FILE);

  //
  // write the header to the log file, then write any errors detected
  // in the configuration. nothing is written to the console if the
  // log file is writable.
  //
  const {header, errors: headerErrors} = makeHeader('1.0.0', config);
  writer.write('header', header);
  if (errors.unknown.length) {
    writer.write('unknown-config-items', errors.unknown.join(', '));
  }
  if (errors.invalid.length) {
    writer.write('invalid-config-values', errors.invalid.join(', '));
  }
  if (headerErrors.length) {
    writer.write('header-errors', headerErrors.join(', '));
  }

  //
  // listen for patch events and write them to the log. the loader thread uses
  // different listeners that forward the events to the main thread.
  //
  const patchListener = (m) => {
  // if it's an error make it concise; there's only one place in each thread
  // where files are patched, so there's no need for a stack trace.
  // a stack trace.
    if (m instanceof Error) {
      const {code, message} = m;
      const patchError = {};
      if (code) {
        patchError.code = code;
      }
      patchError.message = message;
      writer.write('patch-error', patchError);
      return;
    }
    // normal case - just write the log
    writer.write('patch', m);
  };

  // listen for load events and write them to the log. a file being
  // loaded will emit either a load or a patch event, not both.
  const loadListener = (m) => {
    writer.write('load', m);
  };

  //
  // ditto for route events (née metrics events)
  //
  const metricsListener = (m) => {  // main only
    writer.write('route', m);
  };

  // setup patch for the main thread
  const setupPatcher = require('./setup-patcher');
  setupPatcher({type}, patchListener, loadListener);

  //
  // routes and timeseries are main-thread only.
  //
  const routeEmitter = require('./route-emitter');
  routeEmitter.on('route', metricsListener);

  const TimeSeries = require('./time-series');

  const timeSeriesOptions = {tsCallback};

  if (config.GARBAGE_COLLECTION) {
    timeSeriesOptions.gcCallback = gcListener;
  }
  if (config.EVENTLOOP) {
    timeSeriesOptions.elCallback = elListener;
  }

  // undocumented interval setting, primarily for testing.
  let interval = process.env.CSI_ROUTE_METRICS_TIME_SERIES_INTERVAL || 1000;
  interval = Number(interval);

  // eslint-disable-next-line no-unused-vars
  const timeSeries = new TimeSeries(interval, timeSeriesOptions);
  timeSeries.interval.unref();

  function tsCallback(cpuAndMem) {
    writer.write('proc', cpuAndMem);
  }

  function gcListener(gcStats) {
    writer.write('gc', gcStats);
  }

  function elListener(elPercentiles) {
    writer.write('eventloop', elPercentiles);
  }

  if (isMainThread && M.register && type === 'esm') {
    (async() => {
      await import('./esm-hooks/index.mjs');
    })();

  }

};
