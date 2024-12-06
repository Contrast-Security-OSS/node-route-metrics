'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./common-config');
const outputTemplate = require('./log-processor-output-template');

const reporterDir = path.join(__dirname, '../log-processor/reporters');
const reporters = fs.readdirSync(reporterDir).filter(f => f.endsWith('.cjs') && f !== 'base-reporter.cjs');
if (Object.keys(reporters).length === 0) {
  throw new Error('no reporters found');
}

// map name to absolute path so requiring works from any file
const reporterMap = {};
for (const r of reporters) {
  const p = path.resolve(reporterDir, r);
  reporterMap[path.basename(r, '.cjs')] = p;
}

module.exports = {
  get() {
    const {config: cfg, errors} = config.get({defs: 'log-processor'});
    if (cfg.REPORTER in reporterMap) {
      cfg.REPORTER = reporterMap[cfg.REPORTER];
    } else {
      errors.invalid.push(config.pair('reporter'));
      cfg.REPORTER = reporterMap.csv;
    }

    // outputTemplate.get() throws on errors.
    if (cfg.TEMPLATE) {
      try {
        const template = outputTemplate.get(path.resolve(cfg.TEMPLATE));
        cfg.TEMPLATE = template;
      } catch (e) {
        cfg.TEMPLATE = '';
        errors.invalid.push(`${config.pair('template')}\nTemplate Error: ${e.message}`);
      }
    }

    return {config: cfg, errors};
  }
};
