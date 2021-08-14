#!/usr/bin/env node
'use strict';

//
// this module implements the command line interface of the log-processor.
//

const fs = require('fs');

const LogProcessor = require('./log-processor');

/* eslint-disable no-console */

//
// get the configuration, possibly modified by the user.
//
const {config, errors} = require('../config/log-processor-config').get();
if (errors.unknown.length) {
  console.error('unknown-config-items', errors.unknown.join(', '));
}
if (errors.invalid.length) {
  console.error('invalid-config-values', errors.invalid.join(', '));
}

// different reporters render the output in different ways. the two initial
// reporters are csv and json.
let reporter;
try {
  reporter = require(config.REPORTER);
} catch (e) {
  console.error(`failed to load reporter ${reporter}: ${e.message}`);
  reporter = require('./reporters/csv');
}

// the only command line argument is the filename, defaulted if missing.
const file = process.argv[2] || 'route-metrics.log';
const options = {encoding: 'utf8'};

// if the OUTPUT configuration is a number then it's taken to be a file
// descriptor. this was done mainly to make support windows; /dev/tty is
// not valid on windows, but writing to fd 1 works fine.
if (/^\d+$/.test(config.OUTPUT)) {
  options.fd = Number(config.OUTPUT);
}

const stream = fs.createWriteStream(config.OUTPUT, options);
const lp = new LogProcessor(file, reporter, stream, {template: config.TEMPLATE});
lp.read().then(() => {
  lp.summarize();
});
