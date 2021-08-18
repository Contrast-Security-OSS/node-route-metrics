'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./common-config');
const outputTemplate = require('./log-processor-output-template');

const prefix = 'CSI_RM_';
const defs = {
  reporter: {def: 'csv'},
  output: {def: '1'},
  template: {def: null},
  microseconds: {def: false},
};

const reporterDir = path.join(__dirname, '../log-processor/reporters');
const reporters = fs.readdirSync(reporterDir).filter(f => f.endsWith('.js'));

// map name to absolute path so requiring works from any file
const reporterMap = {};
for (const r of reporters) {
  const p = path.resolve(reporterDir, r);
  reporterMap[path.basename(r, '.js')] = p;
}

module.exports = {
  get() {
    const {config: cfg, errors} = config.get({defs, prefix});
    if (cfg.REPORTER in reporterMap) {
      cfg.REPORTER = reporterMap[cfg.REPORTER];
    } else {
      errors.invalid.push(config.pair(prefix, 'reporter'));
      cfg.REPORTER = reporterMap.csv;
    }

    // outputTemplate.get() throws on errors.
    if (cfg.TEMPLATE) {
      try {
        const template = outputTemplate.get(path.resolve(cfg.TEMPLATE));
        cfg.TEMPLATE = template;
      } catch (e) {
        cfg.TEMPLATE = null;
        errors.invalid.push(config.pair(prefix, 'template'));
        errors.invalid.push(`template error ${e.message}`);
      }
    }

    return {config: cfg, errors};
  }
};


