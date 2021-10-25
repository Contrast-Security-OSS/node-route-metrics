'use strict';

module.exports = {
  version: '1.0.0',
  options: {
    reserved: true
  },
  labels: {
    title: 'this is my test server'
  },
  routes: [
    {name: 'noecho (ALL PARAMS)', method: 'POST', regex: /^\/noecho(\?.+)?/},
    {name: 'startsWith', method: 'POST', startsWith: '/me'},
    {name: 'meta (ALL)', method: 'POST', startsWith: '/meta'},
    {name: 'GET /', method: 'GET', pattern: '/'},
    {name: '/wait/:time', method: 'GET', regex: /^\/wait\/.+/},
    {name: '/wait/10', method: 'GET', regex: /^\/wait\/10/},
  ]
};
