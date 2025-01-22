import assert from 'node:assert';
import fs from 'node:fs';

import RouteMetricsResults from './index.mjs';
import read from './read-log.mjs';

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
      const logLines = await read(file);
      // captured with wc -l
      assert.equal(logLines.length, lines);
      logLines.forEach(line => assert.equal(typeof line, 'string'));
    });

    it(`${name}: should convert lines to logObjects`, async function() {
      const logObjects = await read(file, {convert: true});
      assert.equal(logObjects.length, lines);
      logObjects.forEach(line => assert.equal(typeof line, 'object'));
    });

    it(`${name}: indexes an array of logObjects`, async function() {
      const logObjects = await read(file, {convert: true});
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
});
