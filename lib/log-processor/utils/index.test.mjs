import assert from 'node:assert';
import fs from 'node:fs';

import RouteMetricsResults from './index.mjs';

const files = [
  {name: 'minimal-route-metrics.log', counts: {
    lines: 16,
    header: 1,
    patch: 3,
    status: 1,
    proc: 4,
    eventloop: 4,
    gc: 0,
    route: 3,
  }},
  {name: 'nrwb-route-metrics.log', counts: {
    lines: 2075,
    header: 1,
    patch: 1,
    status: 1,
    proc: 13,
    eventloop: 0,
    gc: 11,
    route: 2048,
  }},
];

describe('RouteMetricsResults', function() {
  let arrayRmr;
  let streamRmr;

  for (const {name, counts} of files) {
    const {lines, header, patch, status, proc, eventloop, gc, route} = counts;
    const file = `./test/log-files/${name}`;
    it(`${name}: read an array of log lines`, async function() {
      const logLines = await readRouteMetricsLog(file);
      // captured with wc -l
      assert.equal(logLines.length, lines);
      logLines.forEach(line => assert.equal(typeof line, 'string'));
    });

    it(`${name}: should convert lines to logObjects`, async function() {
      const logObjects = await readRouteMetricsLog(file, {convert: true});
      assert.equal(logObjects.length, lines);
      logObjects.forEach(line => assert.equal(typeof line, 'object'));
    });

    it(`${name}: indexes an array of logObjects`, async function() {
      const logObjects = await readRouteMetricsLog(file, {convert: true});
      const rmr = new RouteMetricsResults();
      rmr.indexArray(logObjects);

      assert.equal(rmr.header.count, header, `headers expected: ${header}`);
      assert.equal(rmr.patch.count, patch, `patches expected: ${patch}`);
      assert.equal(rmr.status.count, status, `statuses expected: ${status}`);
      assert.equal(rmr.proc.count, proc, `procs expected: ${proc}`);
      assert.equal(rmr.eventloop.count, eventloop, `eventloops expected: ${eventloop}`);
      assert.equal(rmr.gc.count, gc, `gc expected: ${gc}`);
      assert.equal(rmr.route.count, route, `routes expected: ${route}`);

      arrayRmr = rmr;
    });

    it(`${name}: indexes a log file stream`, async function() {
      const stream = fs.createReadStream(file);
      const rmr = new RouteMetricsResults();
      await rmr.indexStream(stream);

      assert.equal(rmr.header.count, header, `headers expected: ${header}`);
      assert.equal(rmr.patch.count, patch, `patches expected: ${patch}`);
      assert.equal(rmr.status.count, status, `statuses expected: ${status}`);
      assert.equal(rmr.proc.count, proc, `procs expected: ${proc}`);
      assert.equal(rmr.eventloop.count, eventloop, `eventloops expected: ${eventloop}`);
      assert.equal(rmr.gc.count, gc, `gc expected: ${gc}`);
      assert.equal(rmr.route.count, route, `routes expected: ${route}`);

      streamRmr = rmr;
    });

    it('creates identical RouteMetricsResults from array and stream', function() {
      // this first loop is redundant to the last deepEqual, but it will gives
      // better messages if a test fails.
      const things = ['first', 'last', 'typesIndex', 'foldRules', 'keyedRoutes', 'parseErrors'];
      for (const thing of things) {
        assert.deepEqual(arrayRmr[thing], streamRmr[thing], `expected ${thing} to be the same`);
      }
      // now check everything.
      assert.deepEqual(arrayRmr, streamRmr);
    });
  }

  describe('TypeRoute - minimal-route-metrics.log', function() {
    const file = './test/log-files/minimal-route-metrics.log';
    const expected = {
      'no-rules': new Map([
        ['POST https://localhost:40419/echo', {200: [12724]}],
        ['GET https://localhost:40419/info', {200: [4178]}],
        ['POST https://localhost:40419/meta', {200: [4690]}],
      ]),
      'success-failure': new Map([
        ['POST https://localhost:40419/echo', {success: [12724]}],
        ['GET https://localhost:40419/info', {success: [4178]}],
        ['POST https://localhost:40419/meta', {success: [4690]}],
      ]),
    };

    let rmr;
    before(async function() {
      const stream = fs.createReadStream(file);
      rmr = new RouteMetricsResults();
      await rmr.indexStream(stream);
    });

    it('groups routes by status code with no rules', async function() {
      const groups = rmr.route.groupBy({grouper: 'by-status-code', rules: []});

      assert.deepEqual(groups, expected['no-rules']);
    });

    it('groups routes by success/failure with no rules', async function() {
      const groups = rmr.route.groupBy({grouper: 'by-success-failure', rules: []});

      assert.deepEqual(groups, expected['success-failure']);
    });

    //[
    //  { name: 'noecho (ALL PARAMS)', method: 'POST', regex: /^\/noecho(\?.+)?/ },
    //];
    // a route entry can contain one and only one of: regex, startsWith, pattern
    it('uses grouping rules correctly', async function() {
      const rules = [
        {name: '/api/users/*', method: 'POST', startsWith: '/api/users'},
      ];
      const groups = rmr.route.groupBy({grouper: 'by-success-failure', rules});

      assert.deepEqual(groups, expected['success-failure']);
    });
  });

  describe('TypeRoute - nrwb-route-metrics.log', function() {
    const file = './test/log-files/nrwb-route-metrics.log';
    let expected;

    let rmr;
    before(async function() {
      const stream = fs.createReadStream(file);
      rmr = new RouteMetricsResults();
      await rmr.indexStream(stream);
      /*
GET http://127.0.0.1:4000/api/articles,success,1000
GET http://127.0.0.1:4000/api/articles/feed,success,1000
POST http://127.0.0.1:4000/api/articles,success,1
POST http://127.0.0.1:4000/api/users,success,46
POST http://127.0.0.1:4000/api/users/login,success,1
      */
      const is200 = (r) => r.entry.statusCode >= 200 && r.entry.statusCode < 300;
      const nr200Times = [...rmr.route.filter(r => is200(r))];
      const matches = (r, m, p) => r.entry.method === m && r.entry.url === p;
      const times = (r) => r.entry.et;

      const getTimes = (m, p) => nr200Times.filter(r => matches(r, m, p)).map(times).sort((a, b) => a - b);

      const allApiUsers = [...getTimes('POST', '/api/users'), ...getTimes('POST', '/api/users/login')].sort((a, b) => a - b);

      expected = {
        'no-rules': new Map([
          ['GET http://127.0.0.1:4000/api/articles', {200: [...getTimes('GET', '/api/articles')]}],
          ['GET http://127.0.0.1:4000/api/articles/feed', {200: [...getTimes('GET', '/api/articles/feed')]}],
          ['POST http://127.0.0.1:4000/api/articles', {200: [...getTimes('POST', '/api/articles')]}],
          ['POST http://127.0.0.1:4000/api/users', {201: [...getTimes('POST', '/api/users')]}],
          ['POST http://127.0.0.1:4000/api/users/login', {200: [...getTimes('POST', '/api/users/login')]}],
        ]),
        'success-failure': new Map([
          ['GET http://127.0.0.1:4000/api/articles', {success: [...getTimes('GET', '/api/articles')]}],
          ['GET http://127.0.0.1:4000/api/articles/feed', {success: [...getTimes('GET', '/api/articles/feed')]}],
          ['POST http://127.0.0.1:4000/api/articles', {success: [...getTimes('POST', '/api/articles')]}],
          ['POST http://127.0.0.1:4000/api/users', {success: [...getTimes('POST', '/api/users')]}],
          ['POST http://127.0.0.1:4000/api/users/login', {success: [...getTimes('POST', '/api/users/login')]}],
        ]),
        'rules': new Map([
          ['GET http://127.0.0.1:4000/api/articles', {success: [...getTimes('GET', '/api/articles')]}],
          ['GET http://127.0.0.1:4000/api/articles/feed', {success: [...getTimes('GET', '/api/articles/feed')]}],
          ['POST http://127.0.0.1:4000/api/articles', {success: [...getTimes('POST', '/api/articles')]}],
          ['/api/users*', {success: allApiUsers}],
        ]),
      };
    });

    it('groups routes by status code with no rules', async function() {
      const groups = rmr.route.groupBy({grouper: 'by-status-code', rules: []});

      assert.equal(groups.size, expected['no-rules'].size);
      for (const [key, value] of groups) {
        assert.deepEqual(value, expected['no-rules'].get(key));
      }
    });

    it('groups routes by success/failure with no rules', async function() {
      const groups = rmr.route.groupBy({grouper: 'by-success-failure', rules: []});

      assert.equal(groups.size, expected['success-failure'].size);
      for (const [key, value] of groups) {
        assert.deepEqual(value, expected['success-failure'].get(key));
      }
    });

    //[
    //  { name: 'noecho (ALL PARAMS)', method: 'POST', regex: /^\/noecho(\?.+)?/ },
    //];
    // a route entry can contain one and only one of: regex, startsWith, pattern
    it('uses grouping rules correctly', async function() {
      const rules = [
        {name: '/api/users*', method: 'POST', startsWith: '/api/users'},
      ];
      const groups = rmr.route.groupBy({grouper: 'by-success-failure', rules});

      assert.equal(groups.size, expected['rules'].size);
      for (const [key, value] of groups) {
        assert.deepEqual(value, expected['rules'].get(key));
      }
    });
  });

});

//
// the following will need to move to a test/utils (or similar) place if more
// tests end up using it.
//

import fsp from 'node:fs/promises';

//
// take the brute force approach now, and read the entire file into memory. if
// it ever becomes a problem, we should just request bigger machines as it's
// much more complex to handle all this with streaming data.
//
async function readRouteMetricsLog(filename, options = {}) {
  const {convert = false} = options;

  // read the route-metrics log file
  let logText = await fsp.readFile(filename, {encoding: 'utf8'});
  logText = logText.split('\n').slice(0, -1);

  if (!convert) {
    return logText;
  }

  const logObjects = logText.map(JSON.parse);

  return logObjects;
}
