'use strict';

//
// this test module is the last one written and uses better logic than the
// other server-log testing modules.
// - waits for specific sets of log entries as opposed to a line count
// - doesn't require log entries to be in a specific order
// - can ignore duplicate log entries (gc, eventloop)
//

const {expect} = require('chai');

const {makeTestGenerator, setup} = require('./_helpers.js');
const {
  Checkers,
  HeaderChecker,
  PatchChecker,
  RouteChecker,
  GcChecker,
  EventloopChecker,
  ProcChecker,
} = require('./checks/index.js');

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
    const overrides = {
      config: {
        GARBAGE_COLLECTION: !!t.env.CSI_RM_GARBAGE_COLLECTION,
        EVENTLOOP: !!t.env.CSI_RM_EVENTLOOP,
      },
    };

    const {desc} = t;

    const expectedGcCount = t.env.CSI_RM_GARBAGE_COLLECTION ? 1 : 0;
    const expectedEventloopCount = t.env.CSI_RM_EVENTLOOP ? 1 : 0;

    describe(desc, function() {
      this.timeout(10000);
      let lastArgs;
      let lastLogLines;

      let checkers;
      //
      // start the server
      //
      before(async function() {
        // don't wait so long
        process.env.CSI_ROUTE_METRICS_TIME_SERIES_INTERVAL = 100;
        testServer = await setup(t);
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
        const augmentedOverrides = Object.assign({execArgv: t.nodeArgs}, overrides);
        const requiredPatches = PatchChecker.getMinimalPatchEntries(t);

        checkers = new Checkers({initialCheckers: [
          {CheckerClass: HeaderChecker, constructorArgs: [pdj, augmentedOverrides]},
          {CheckerClass: PatchChecker, constructorArgs: [{requiredPatches}]},
        ]});
      });

      afterEach(function() {
        // if a test failed make it easier to debug how the server was created
        if (debugging && this.currentTest.state === 'failed') {
          /* eslint-disable no-console */
          console.log('new Server(', lastArgs, ')');
          console.log('lastLogLines:', lastLogLines);}
      });

      //
      // the tests start here
      //
      it('header, patch, and time-series entries are all correct', async function() {
        this.timeout(12000);

        const gcChecker = new GcChecker({requiredEntries: expectedGcCount});
        const eventloopChecker = new EventloopChecker({requiredEntries: expectedEventloopCount});
        const procChecker = new ProcChecker();
        checkers.add(gcChecker);
        checkers.add(eventloopChecker);
        checkers.add(procChecker);

        const options = {maxWaitTime: 10000};
        const {lines, numberOfLinesNeeded} = await checkers.waitForLogLines(options);
        lastLogLines = lines;

        const logObjects = lines.map(line => JSON.parse(line));
        // change to use allFound flag.
        expect(lines.length).gte(numberOfLinesNeeded, 'not enough lines');

        checkers.check(logObjects);

        const gcCount = gcChecker.getCount();
        if (expectedGcCount) {
          const message = `expected ${expectedGcCount} gc entries, got ${gcCount}`;
          expect(gcCount).gte(expectedGcCount, message);
        } else {
          expect(gcCount).equal(0, `found ${gcCount} gc entries, expected 0`);
        }
        const elCount = eventloopChecker.getCount();
        if (expectedEventloopCount) {
          const message = `expected ${expectedEventloopCount} eventloop entries, got ${elCount}`;
          expect(elCount).gte(expectedEventloopCount, message);
        } else {
          expect(elCount).equal(0, `found ${elCount} eventloop entries, expected 0`);
        }
      });

      it('post and get entries are present with time-series entries', async function() {
        const gcChecker = new GcChecker({requiredEntries: expectedGcCount});
        checkers.add(gcChecker);

        const eventloopChecker = new EventloopChecker({requiredEntries: expectedEventloopCount});
        checkers.add(eventloopChecker);

        const routesToCheck = [
          {method: 'POST', path: '/echo'},
          {method: 'POST', path: '/meta'},
          {method: 'GET', path: '/info'},
        ];
        const routeCheckerOptions = {
          routesToCheck,
          allowDuplicates: false,
          allowUnknownRoutes: false,
        };
        const routeChecker = new RouteChecker(routeCheckerOptions);
        checkers.add(routeChecker);

        // now execute some requests
        const obj = {cat: 'tuna', dog: 'beef', snake: 'mouse'};
        testServer.post('/echo', obj);
        testServer.post('/meta', obj);
        testServer.get('/info');

        const options = {maxWaitTime: 3500};
        const {lines, numberOfLinesNeeded} = await checkers.waitForLogLines(options);
        lastLogLines = lines;

        expect(lines.length).gte(numberOfLinesNeeded, 'not enough lines');
        const logObjects = lines.map(line => JSON.parse(line));

        checkers.check(logObjects);
      });
    });
  }
});
