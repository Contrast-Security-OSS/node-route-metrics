'use strict';

const {patcher, emitter: patchEmitter} = require('./patcher');
const metricsEmitter = require('./metrics-emitter');

const makeHeader = require('./writer/make-header');

const {config, errors} = require('./config/agent-config').get();
const Writer = require('./writer/make-writer');
const writer = new Writer(config.LOG_FILE);

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

const metricsListener = (m) => {
  writer.write('metrics', m);
};

patcher.enable();
patchEmitter.on('patch', patchListener);
metricsEmitter.on('metrics', metricsListener);
