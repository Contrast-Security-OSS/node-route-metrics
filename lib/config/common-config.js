'use strict';

const prefix = 'CSI_RM_';

const agentDefaults = {
  LOG_FILE: {def: 'route-metrics.log'},
  OUTPUT_CONFIG: {def: ''},
  GARBAGE_COLLECTION: {def: false},
  EVENTLOOP: {def: false},
  EVENTLOOP_RESOLUTION: {def: 20},      // ms
};

const logProcessorDefaults = {
  REPORTER: {def: 'csv'},
  OUTPUT: {def: '1'},
  TEMPLATE: {def: ''},
  MICROSECONDS: {def: false},
};

const getDefaultConfig = function(defs) {
  defs = {
    agent: agentDefaults,
    'log-processor': logProcessorDefaults,
  }[defs];
  
  const defaults = {};
  for (const k in defs) {
    defaults[k] = defs[k].def;
  }
  return defaults;
};

const agentDefs = getDefaultConfig('agent');
const logProcessorDefs = getDefaultConfig('log-processor');

/**
 * @typedef {object} ConfigErrors
 * @property {string[]} unknown - unknown keys
 * @property {object[]} invalid - {key: value} where value is invalid.
 */

/**
 * @typedef {object} ConfigResult
 * @property {object} config - KV pairs
 * @property {ConfigErrors} errors
 */

/**
 * @returns {ConfigResult}
 */
function get({defs}) {
  const config = Object.assign({}, {agent: agentDefs, 'log-processor': logProcessorDefs}[defs]);
  const errors = {
    unknown: [],
    invalid: []
  };
  // get the alternate set of env vars. even if an env var is invalid for the defs
  // being checked, we ignore it if it's valid for the alternate.
  const alternate = defs === 'agent' ? logProcessorDefs : agentDefs;
  for (const k in process.env) {
    if (!k.startsWith(prefix)) {
      continue;
    }
    const key = k.slice(prefix.length);

    if (key in config) {
      // set to the user-requested value
      const defaultType = typeof config[key];
      if (defaultType === 'boolean') {
        const value = process.env[k];
        if (value === 'false') {
          config[key] = false;
        } else if (value === 'true') {
          config[key] = true;
        } else {
          errors.invalid.push(`${k} must be true or false, not ${value}`);
        }
      } else if (defaultType === 'number') {
        const n = Number(process.env[k]);
        if (!Number.isNaN(n)) {
          config[key] = n;
        } else {
          errors.invalid.push(`${k} must be a number, not ${n}`);
        }
      } else if (defaultType === 'string') {
        config[key] = process.env[k];
      } else if (key in config) {
        throw new Error(`silly programmer, ${defaultType} is not yet valid for options: ${k}`);
      }
      continue;
    }

    // allow for no prefix (don't complain about all environment variables in
    // that case). and, if the key is for either the agent or the log-processor
    // don't complain about it being unknown (even if not valid for the whichever
    // is actually being run). this allows the user to set the vars via exporting
    // on the command line as opposed to just setting them in the command.
    if (prefix && !(key in alternate)) {
      errors.unknown.push(k);
      continue;
    }

  }
  return {config, errors};
}

module.exports = {
  get,
  pair(name) {
    return `${name}=${process.env[name]}`;
  }
};
