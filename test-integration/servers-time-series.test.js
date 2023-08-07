'use strict';

//
// this test module is the last one written and uses better logic than the
// other server-log testing modules.
// - waits for specific sets of log entries as opposed to a line count
// - doesn't require log entries to be in a specific order
// - can ignore duplicate log entries (gc, eventloop)
//

const fsp = require('fs').promises;
const path = require('path');

const fetch = require('node-fetch');
const {expect} = require('chai');

const Server = require('../test/servers/server');
const {makeTestGenerator} = require('../test/helpers');
const {
  checks,
  makeLogEntryChecker,
  makeMetricsChecker,
  makePatchEntryCheckers,
  makeTimeSeriesCheckers,
} = require('../test/checks');

const pdj = require('../test/servers/package.json');

// get helpful output when true and tests fail
const debugging = false;

// returns an array of additional env var settings to make combinations with
function getEnv(defaultEnv) {
  return [
    Object.assign({}, defaultEnv, {CSI_RM_GARBAGE_COLLECTION: true}),
    Object.assign({}, defaultEnv, {CSI_RM_EVENTLOOP: true}),
  ];
}

const tests = makeTestGenerator({getEnv});

// save these initial values
const previousTLS = !!process.env.NODE_TLS_REJECT_UNAUTHORIZED;
const argv = process.argv;

//
// execute tests for each server and set of command line args and verify
// that the correct time-series entries are present.
//
describe('server time-series tests', function() {
  for (const t of tests()) {
    let testServer;
    // construct expected config based on the test's environment vars
    const expectedLogEntries = [];
    const overrides = {
      config: {
        GARBAGE_COLLECTION: !!t.env.CSI_RM_GARBAGE_COLLECTION,
        EVENTLOOP: !!t.env.CSI_RM_EVENTLOOP,
      }
    };

    const {server, base, desc, nodeArgs, appArgs} = t;
    // only need these in combination with doing POSTs and GETs

    describe(desc, function() {
      this.timeout(10000);
      let lastArgs;
      //
      // start the server
      //
      before(async function() {
        // don't wait so long
        process.env.CSI_ROUTE_METRICS_TIME_SERIES_INTERVAL = 100;
        process.env.CSI_ROUTE_METRICS_AVERAGING_INTERVAL = 250;
        return fsp.unlink('route-metrics.log')
          .catch(e => null)
          .then(() => {
            const absoluteServerPath = path.resolve(`./test/servers/${server}`);
            const nodeargs = [...nodeArgs, absoluteServerPath, ...appArgs];
            lastArgs = nodeargs;
            const env = Object.assign({}, process.env, t.env);
            testServer = new Server(nodeargs, {env});
            // make argv match what the server will see.
            process.argv = [process.argv[0], absoluteServerPath, ...appArgs];
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
            return testServer.readyPromise;
          });
      });

      after(async function() {
        const code = 'SIGKILL';
        if (!previousTLS) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }
        // SIGTERM didn't work with istanbul but adding a stop endpoint
        // did. but that doesn't work with https and SIGKILL does.
        //return testServer.stop({type: 'url', value: `${base}/stop/0`})
        return testServer.stop({type: 'signal', value: code})
          .then(signal => {
            // reset argv
            process.argv = argv;
            if (typeof signal === 'number') {
              expect(signal).equal(0, 'exit code should be 0');
            } else {
              expect(signal).equal(code);
            }
          });
      });

      beforeEach(function() {
        // ignore the log entries created by the test generator. they do not
        // take header overrides into account; the original implementation
        // still works but should be replaced by explicit construction of the
        // expected log entries.
        expectedLogEntries.length = 0;
        expectedLogEntries.push(makeLogEntryChecker('header', pdj, overrides));
        expectedLogEntries.push(...makePatchEntryCheckers(t));
      });

      afterEach(function() {
        // if a test failed make it easier to debug how the server was created
        if (this.currentTest.state === 'failed' && debugging) {
          // eslint-disable-next-line no-console
          console.log('new Server(', lastArgs, ')');
        }
      });

      //
      // the tests start here
      //
      it('header, patch, and time-series entries are all correct', async function() {
        this.timeout(12000);
        const {checkers: timeSeriesEntries, gc, eventloop, proc} = makeTimeSeriesCheckers(t);
        const typesNeeded = {
          header: 1,
          patch: expectedLogEntries.length - 1,
          gc,
          eventloop,
          proc
        };
        const linesNeeded = expectedLogEntries.length + timeSeriesEntries.length;

        const options = {maxWaitTime: 10000};
        const {lines: logLines} = await checks.waitForLines(typesNeeded, options);

        if (debugging && logLines.length < linesNeeded) {
          // eslint-disable-next-line no-console
          console.log(logLines);
        }

        const logObjects = logLines.map(line => JSON.parse(line));
        // make sure all header and patch entries are present
        expect(logLines.length).gte(linesNeeded, 'not enough lines');

        for (let i = 0; i < expectedLogEntries.length; i++) {
          expect(expectedLogEntries[i]).property('validator').a('function', `$missing validator index ${i}`);
          const {validator} = expectedLogEntries[i];
          expect(logObjects[i]).property('type').equal(expectedLogEntries[i].type);
          validator(logObjects[i].entry);
        }

        // time series can appear multiple times
        const tsEntries = {};
        for (const ts of timeSeriesEntries) {
          tsEntries[ts.type] = ts;
        }

        // only check the remaining items (time-series)
        const remaining = logObjects.slice(expectedLogEntries.length);

        // allows time-series and metrics to be interleaved and in any order.
        // probably a candidate for a utility function so it can be applied
        // to other tests.
        for (const entry of remaining) {
          if (entry.type in tsEntries) {
            tsEntries[entry.type].validator(entry.entry);
          } else {
            throw new Error('unexpected entry type');
          }
        }
      });

      it('post and get entries are present with time-series entries', async function() {
        const {checkers: timeSeriesEntries, gc, eventloop} = makeTimeSeriesCheckers(t);

        const metricsEntries = [
          makeMetricsChecker('post', '/echo'),
          makeMetricsChecker('post', '/meta'),
          makeMetricsChecker('get', '/info'),
        ];

        // now execute some requests
        const obj = {cat: 'tuna', dog: 'beef', snake: 'mouse'};
        post(`${base}/echo`, obj);
        post(`${base}/meta`, obj);
        get(`${base}/info`);

        const typesNeeded = {
          header: 1,
          patch: expectedLogEntries.length - 1,
          metrics: metricsEntries.length,
          gc,
          eventloop,
        };

        const options = {maxWaitTime: 3500};
        const {lines: logLines, linesNeeded} = await checks.waitForLines(typesNeeded, options);

        if (debugging && logLines.length < linesNeeded) {
          // eslint-disable-next-line no-console
          console.log(logLines);
        }

        expect(logLines.length).gte(linesNeeded, 'not enough lines');
        const logObjects = logLines.map(line => JSON.parse(line));

        for (let i = 0; i < expectedLogEntries.length; i++) {
          expect(expectedLogEntries[i]).property('validator').a('function', `$missing validator index ${i}`);
          const {validator} = expectedLogEntries[i];
          expect(logObjects[i]).property('type').equal(expectedLogEntries[i].type);
          validator(logObjects[i].entry);
        }

        // one time for each of these
        const metricsEntriesLeft = {};
        for (const me of metricsEntries) {
          metricsEntriesLeft[`${me.method}${me.pathEnd}`] = me;
        }
        // multiple times for these
        const tsEntries = {};
        for (const ts of timeSeriesEntries) {
          tsEntries[ts.type] = ts;
        }


        // only check the remaining items (time-series and metrics)
        const remaining = logObjects.slice(expectedLogEntries.length);

        // allows time-series and metrics to be interleaved and in any order.
        // probably a candidate for a utility function so it can be applied
        // to other tests.
        for (const entry of remaining) {
          if (entry.type in tsEntries) {
            tsEntries[entry.type].validator(entry.entry);
          } else if (entry.type === 'route') {
            const me = `${entry.entry.method.toLowerCase()}${entry.entry.url}`;
            if (me in metricsEntriesLeft) {
              delete metricsEntriesLeft[me];
            } else if (debugging) {
              // eslint-disable-next-line no-console
              console.log(`unexpected metrics entry: ${me}`);
            }
          } else {
            throw new Error('unexpected entry type');
          }
        }
        const leftoverKeys = Object.keys(metricsEntriesLeft);
        expect(leftoverKeys).eql([], `metrics not found ${leftoverKeys.join(',')}`);
      });
    });
  }
});

async function post(url, obj) {
  const options = {
    method: 'post',
    body: JSON.stringify(obj),
    headers: {'content-type': 'application/json'}
  };
  return fetch(url, options)
    .then(res => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      return res;
    })
    .then(res => res.json());
}

async function get(url) {
  const options = {
    method: 'get'
  };
  return fetch(url, options)
    .then(res => {
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      return res;
    });
}
