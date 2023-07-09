'use strict';

//+
// example template that collects all routes beginning with "/noecho" into
// one route name "noecho (ALL PARAMS)".
//-
module.exports = {
  // template format version
  version: '1.0.0',
  // reserved for future use
  options: {
    reserved: true
  },
  // allow labeling when reporting in the future
  labels: {
    title: 'this is my test server'
  },
  // group routes that match the regex and method as the specified name. a route can
  // match more than one regex.
  routes: [
    {name: 'noecho (ALL PARAMS)', method: 'POST', regex: /^\/noecho(\?.+)?/},
  ]
};
