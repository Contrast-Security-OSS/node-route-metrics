'use strict';

const fsp = require('fs').promises;
const path = require('path');

const {expect} = require('chai');
const semver = require('semver');

const Server = require('../test/servers/server');
const {makeTestGenerator} = require('../test/helpers');

const {
  Checkers,
  HeaderChecker,
  PatchChecker,
  RouteChecker,
} = require('./checks');

const pdj = require('../test/servers/package.json');

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

    const {server, base, desc, nodeArgs, appArgs} = t;

    describe(desc, function() {
      this.timeout(10000);
      let lastArgs;
      let lastLogLines;
      //
      // start the server
      //
      before(async function() {
        return fsp.unlink('route-metrics.log')
          .catch(e => null)
          .then(() => {
            const absoluteServerPath = path.resolve(`./test/servers/${server}`);
            const nodeargs = [...nodeArgs, absoluteServerPath, ...appArgs];
            lastArgs = nodeargs;
            testServer = new Server(nodeargs);
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
        const overrides = {execArgv: t.nodeArgs};
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
        const obj = {cat: 'tuna', dog: 'beef', snake: 'mouse'};

        await testServer.post(`${base}/echo`, obj);
        await testServer.post(`${base}/meta`, obj);
        await testServer.get(`${base}/info`);

        // check that three routes are present. should change to specify routes
        // or route patterns and count?
        const routeChecker = new RouteChecker({routesExpected: 3});
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
        await testServer.post(`${base}/stop/0`, {})
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
