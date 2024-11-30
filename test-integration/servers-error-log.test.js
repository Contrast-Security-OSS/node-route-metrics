'use strict';

const {expect} = require('chai');

const {makeTestGenerator} = require('./_helpers');

const {
  Checkers,
  HeaderChecker,
  PatchChecker,
  CustomChecker,
} = require('./checks');

const pdj = require('../test/servers/package.json');

function getEnv() {
  return [{
    CONTRAST_DEV: true,
    CSI_RM_XYZZY: 'who cares?',
  }];
}

// save these values so they can be restored
const argv = process.argv;
const previousTLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

// make the test generator. it creates the combinations for testing. the
// assumptions can be modified via options.
const tests = makeTestGenerator({getEnv});

describe('server error log tests', function() {
  //
  // execute tests for each server/route-metrics/protocol/env/log-entries/etc.
  // combination specified.
  //
  for (const t of tests()) {
    let testServer;
    let checkers;
    const {desc} = t;

    describe(desc, function() {
      this.timeout(10000);
      let lastArgs;
      let lastLogLines;
      //
      // start the server
      //
      before(async function() {
        testServer = await t.setup();
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
          })
          .catch(e => {
            // eslint-disable-next-line no-console
            console.log('stop failed', e);
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
      // the test
      //
      it('header and patch entries are present after startup', async function() {
        const unknownConfigChecker = new CustomChecker({type: 'unknown-config-items'});
        checkers.add(unknownConfigChecker);
        const {lines, numberOfLinesNeeded} = await checkers.waitForLogLines();

        // make sure all header and patch entries are present
        expect(lines.length).gte(numberOfLinesNeeded, 'not enough lines');
        const logObjects = lines.map(line => JSON.parse(line));

        checkers.check(logObjects);
        expect(unknownConfigChecker.getCount()).equal(1);
      });

    });
  }
});
