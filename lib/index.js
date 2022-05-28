'use strict';

//
// startup code.
//
const {patcher, emitter: patchEmitter} = require('./patcher');
const metricsEmitter = require('./metrics-emitter');
const Interval = require('./time-series/interval');

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
// listen for patch events and write them to the log
//
const patchListener = (m) => {
  // if it's an error make it concise; there's only
  // one place things are patched here, no need for
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

//
// ditto for metrics events
//
const metricsListener = (m) => {
  writer.write('metrics', m);
};

// enable patching and start listening for events
patcher.enable();
patchEmitter.on('patch', patchListener);
metricsEmitter.on('metrics', metricsListener);

let timeSeries;

if (config.garbageCollection || config.eventloop) {
  const intervalOptions = {};
  if (config.garbageCollection) {
    intervalOptions.gcCallback = gcListener;
  }
  if (config.eventloop) {
    intervalOptions.elCallback = elListener;
  }
  // eslint-disable-next-line no-unused-vars
  timeSeries = new Interval(1000, intervalOptions);
}

function gcListener(gcStats) {
  writer.write('gc', gcStats);
}

function elListener(elPercentiles) {
  writer.write('eventloop', elPercentiles);
}
