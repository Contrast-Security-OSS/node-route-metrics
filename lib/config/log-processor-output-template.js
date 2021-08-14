'use strict';

//
// this just throws on any error. the caller must handle that.
//
function get(file) {
  const template = require(file);

  if (template.version !== '1.0.0') {
    throw new Error(`unknown template version ${template.version}`);
  }

  if (!Array.isArray(template.routes)) {
    throw new Error('template routes must be an array');
  }

  for (const r of template.routes) {
    if (!r.name || !r.method) {
      throw new Error('template routes must have a name and method property');
    }
    // logical XOR
    if (r.pattern ? r.regex : !r.regex) {
      throw new Error(`route ${r.name} must have either pattern or regex`);
    }

    // allow a json file specifying a regex as a string. RegExp can throw.
    if (r.regex && !(r.regex instanceof RegExp)) {
      r.regex = new RegExp(r.regex);
    }
  }

  return template;
}

module.exports = {get};
