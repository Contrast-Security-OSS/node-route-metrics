'use strict';

const path = require('node:path');
const {expect} = require('chai');
const semver = require('semver');

const {makeTestGenerator} = require('./_helpers');

const {
  Checkers,
  HeaderChecker,
  PatchChecker,
  RouteChecker,
} = require('./checks');

const pdj = require('../test/servers/package.json');
const app_dir = path.resolve(__dirname, '../test/servers');

const tests = makeTestGenerator({});

// for some reason v18 takes longer for the simple tests
const v18 = semver.satisfies(process.version, '>=18.0.0 <19.0.0');

// save these initial values because they will be modified and
// need to be reset.
const previousTLS = !!process.env.NODE_TLS_REJECT_UNAUTHORIZED;
const argv = process.argv;

describe('server log tests', function() {
  //
  // execute tests for each server and set of command line args
  //
  for (const t of tests()) {
    let testServer;
    let checkers;

    const {desc} = t;

    describe(desc, function() {
      this.timeout(10000);
      let lastArgs;
      let lastLogLines;

      before(async() => {
        // delete any existing log file and start the server. this suite of
        // tests starts one server for each set of tests, so the checks need
        // to be cumulative for each subsequent step. it's duplicate code but
        // doesn't require starting a new server as often.
        testServer = await t.setup();

        // remember last args so they can be displayed if a test fails.
        lastArgs = t.nodeArgs;
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
        const overrides = {execArgv: t.nodeArgs, app_dir};
        const requiredPatches = PatchChecker.getMinimalPatchEntries(t);

        // all tests check for the header and patch entries
        const initialCheckers = [
          {CheckerClass: HeaderChecker, constructorArgs: [pdj, overrides]},
          {CheckerClass: PatchChecker, constructorArgs: [{requiredPatches}]},
        ];
        checkers = new Checkers({initialCheckers});
      });

      afterEach(function() {
        // if a test failed make it easier to debug how the server was created
        if (false && this.currentTest.state === 'failed') {
          /* eslint-disable no-console */
          console.log('new Server(', lastArgs, ')');
          console.log('logLines', lastLogLines);
          //const opts = {depth: 10, colors: false};
          /* eslint-enable no-console */
        }
      });

      //
      // the tests start here
      //
      it('header and patch entries are present after startup', async function() {
        const opts = {};
        if (v18 && t.desc === 'simple with route-metrics + node agent via http (http)') {
          opts.maxWaitTime = 2000;
        }
        const {lines, numberOfLinesNeeded} = await checkers.waitForLogLines(opts);
        lastLogLines = lines;

        expect(lines.length).gte(numberOfLinesNeeded, 'not enough lines');
        const logObjects = lines.map(line => JSON.parse(line));

        checkers.check(logObjects);
      });

      it('post and get entries are present', async function() {
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

        const obj = {cat: 'tuna', dog: 'beef', snake: 'mouse'};
        await testServer.post('/echo', obj);
        await testServer.post('/meta', obj);
        await testServer.get('/info');

        // check that three routes are present. should change to specify routes
        // or route patterns and count?
        checkers.add(routeChecker);

        const opts = {maxWaitTime: 1000};
        const {lines, numberOfLinesNeeded} = await checkers.waitForLogLines(opts);
        lastLogLines = lines;

        expect(lines.length).gte(numberOfLinesNeeded, 'not enough lines');
        const logObjects = lines.map(line => JSON.parse(line));

        checkers.check(logObjects);
        expect(routeChecker.getCount()).equal(3);
      });

      it('do not write a record if end() is not called', async function() {
        // the log is accumulated from test to test, so these routes appear
        // again. but we need a new checker or "allow duplicates" will fail
        // because the checker counts the number of times a route is seen.
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

        // this route is typically accessed by calling testServer.stop() but
        // is called directly to verify that no route entry is written when
        // the server doesn't call .end() before exiting.
        await testServer.post('/stop/0', {})
          .then(() => {
            throw new Error('the server should not return a response');
          })
          .catch(e => {
            expect(e.code).equal('ECONNRESET');
          });

        const {lines, numberOfLinesNeeded} = await checkers.waitForLogLines();
        lastLogLines = lines;

        expect(lines.length).gte(numberOfLinesNeeded, 'not enough lines');
        const logObjects = lines.map(line => JSON.parse(line));

        checkers.check(logObjects);
      });
    });
  }
});
