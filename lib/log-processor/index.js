#!/usr/bin/env node
'use strict';

const fs = require('fs');

const LogProcessor = require('./log-processor');

/* eslint-disable no-console */

const {config, errors} = require('../config/log-processor-config').get();
if (errors.unknown.length) {
  console.error('unknown-config-items', errors.unknown.join(', '));
}
if (errors.invalid.length) {
  console.error('invalid-config-values', errors.invalid.join(', '));
}

let reporter;
try {
  reporter = require(config.REPORTER);
} catch (e) {
  console.error(`failed to load reporter ${reporter}: ${e.message}`);
  reporter = require('./reporters/csv');
}

//
const file = process.argv[2] || 'route-metrics.log';
const options = {encoding: 'utf8'};
if (/^\d+$/.test(config.OUTPUT)) {
  options.fd = Number(config.OUTPUT);
}

const output = fs.createWriteStream(config.OUTPUT, options);
const lp = new LogProcessor(file, reporter, output, {template: config.TEMPLATE});
lp.read().then(() => {
  lp.summarize();
});
