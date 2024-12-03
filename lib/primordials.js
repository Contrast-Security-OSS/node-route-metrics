'use strict';

// rather than define these in both this file and the primordials.mjs file, the
// that import primordials.mjs to must import default as primordials and then
// destructure the needed functions from that.
//
// an alternative would be to use createRequire, but that seems worse.

const ArrayPrototypeJoin = Array.prototype.join;
const StringPrototypeEndsWith = String.prototype.endsWith;
const StringPrototypeSlice = String.prototype.slice;
const StringPrototypeSplit = String.prototype.split;
const JSONParse = JSON.parse;

module.exports = {
  ArrayPrototypeJoin,
  StringPrototypeEndsWith,
  StringPrototypeSlice,
  StringPrototypeSplit,
  JSONParse
};
