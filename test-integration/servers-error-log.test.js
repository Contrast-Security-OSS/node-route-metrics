'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const {expect} = require('chai');

const Server = require('../test/servers/server');
const {makeTestGenerator} = require('../test/helpers');
const {checks, makeLogEntryChecker, makePatchEntryCheckers} = require('../test/checks');

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
    const {server} = t;
    const env = Object.assign({}, process.env, t.env);

    // build the array of expected log entries.
    const logEntries = [makeLogEntryChecker('header', pdj)];
    logEntries.push(makeLogEntryChecker('unknown-config-items'));
    const patchEntries = makePatchEntryCheckers(t);
    logEntries.push(...patchEntries);

    describe(t.desc, function() {
      let testServer;
      this.timeout(10000);
      //
      // start the server
      //
      before(async function() {
        return fsp.unlink('route-metrics.log')
          .catch(e => null)
          .then(() => {
            const absoluteServerPath = path.resolve(`./test/servers/${server}`);
            const nodeargs = [...t.nodeArgs, absoluteServerPath, ...t.appArgs];
            testServer = new Server(nodeargs, {env});
            // make argv match what the server will see.
            process.argv = [process.argv[0], absoluteServerPath, ...t.appArgs];
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
            return testServer.readyPromise;
          });
      });

      after(async function() {
        if (!previousTLS) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }

        const code = 'SIGKILL';
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

      afterEach(function() {
        if (this.currentTest.state !== 'failed' || !process.env.RM_DEBUG_TESTS) {
          return;
        }
        const file = fs.readFileSync('route-metrics.log', 'utf8');
        const patches = file.split('\n').filter(line => line).map(JSON.parse).filter(line => line.type === 'patch');
        // eslint-disable-next-line no-console
        console.log(patches);
      });

      //
      // the test
      //
      it('header and patch entries are present after startup', async function() {
        const typesNeeded = {
          header: 1,
          patch: patchEntries.length,
          'unknown-config-items': 1
        };
        const {lines: logLines, linesNeeded} = await checks.waitForLines(typesNeeded);

        // make sure all header and patch entries are present
        expect(logLines.length).gte(linesNeeded, 'not enough lines');
        const logObjects = logLines.map(line => JSON.parse(line));

        for (let i = 0; i < logEntries.length; i++) {
          expect(logEntries[i]).property('validator').a('function', `$missing validator index ${i}`);
          const {validator} = logEntries[i];
          expect(logObjects[i]).property('type').equal(logEntries[i].type);
          validator(logObjects[i].entry);
        }
      });

    });
  }
});
