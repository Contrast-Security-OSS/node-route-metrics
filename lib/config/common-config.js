'use strict';

const makeDefaultConfig = function(defs) {
  const defaults = {};
  for (const k in defs) {
    defaults[objectToEnvForm(k)] = defs[k].def;
  }
  return defaults;
};

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
function get({defs, prefix}) {
  const config = makeDefaultConfig(defs);
  const errors = {
    unknown: [],
    invalid: []
  };
  for (const k in process.env) {
    if (!k.startsWith(prefix)) {
      continue;
    }
    const key = k.slice(prefix.length);

    if (key in config) {
      // set to the user-requested value
      if (typeof config[key] === 'boolean') {
        if (process.env[k] === 'false') {
          config[key] = false;
        } else if (process.env[k] === 'true') {
          config[key] = true;
        }
      } else {
        config[key] = process.env[k];
      }
      continue;
    }

    // allow for no prefix
    if (prefix) {
      errors.unknown.push(k);
      continue;
    }

  }
  return {config, errors};
}

function objectToEnvForm(s) {
  return s.replace(/([A-Z])/g, ($1) => `_${$1}`).toUpperCase();
}

module.exports = {
  get,
  pair(prefix, name) {
    const env = `${prefix}${objectToEnvForm(name)}`;
    return `${env}=${process.env[env]}`;
  }
};
