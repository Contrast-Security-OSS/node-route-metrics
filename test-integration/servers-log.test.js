'use strict';

const fsp = require('fs').promises;
const path = require('path');

const fetch = require('node-fetch');
const {expect} = require('chai');

const Server = require('../test/servers/server');
const {makeTestGenerator} = require('../test/helpers');
const {checks, makeLogEntryChecker, makePatchEntryCheckers} = require('../test/checks');

const pdj = require('../test/servers/package.json');

const tests = makeTestGenerator({});

const metricsEntries = [
  makeLogEntryChecker('metrics'),
  makeLogEntryChecker('metrics'),
  makeLogEntryChecker('metrics'),
];

// save these initial values
const previousTLS = !!process.env.NODE_TLS_REJECT_UNAUTHORIZED;
const argv = process.argv;

describe('server log tests', function() {
  //
  // execute tests for each server and set of command line args
  //
  for (const t of tests()) {
    let testServer;

    // build the array of expected log entries.
    const logEntries = [makeLogEntryChecker('header', pdj)];
    const patchEntries = makePatchEntryCheckers(t);
    logEntries.push(...patchEntries);
    logEntries.push(...metricsEntries);

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

      afterEach(function() {
        // if a test failed make it easier to debug how the server was created
        if (this.currentTest.state === 'failed') {
          /* eslint-disable no-console */
          console.log('new Server(', lastArgs, ')');
          console.log('last logLines', lastLogLines);
          console.log('last logEntries', logEntries.map(e => e.validator.show()));
          /* eslint-enable no-console */
        }
      });

      //
      // the tests start here
      //
      it('header and patch entries are present after startup', async function() {
        const subset = logEntries.filter(e => {
          return e.type === 'header' || e.type === 'patch';
        });

        const typesNeeded = {
          header: 1,
          patch: patchEntries.length,
        };
        const {lines: logLines, linesNeeded} = await checks.waitForLines(typesNeeded);
        lastLogLines = logLines;

        expect(logLines.length).gte(linesNeeded, 'not enough lines');
        const logObjects = logLines.map(line => JSON.parse(line));

        for (let i = 0; i < subset.length; i++) {
          expect(subset[i]).property('validator').a('function', `$missing validator index ${i}`);
          const {validator} = subset[i];
          expect(logObjects[i]).property('type').equal(subset[i].type);
          validator(logObjects[i].entry);
        }
      });

      it('post and get entries are present', async function() {
        const obj = {cat: 'tuna', dog: 'beef', snake: 'mouse'};

        await post(`${base}/echo`, obj);
        await post(`${base}/meta`, obj);
        await get(`${base}/info`);

        const typesNeeded = {
          header: 1,
          patch: patchEntries.length,
          metrics: 3,
        };
        const {lines: logLines, linesNeeded} = await checks.waitForLines(typesNeeded);
        lastLogLines = logLines;

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

      it('do not write a record if end() is not called', async function() {

        await post(`${base}/stop/0`, {})
          .then(() => {
            throw new Error('the server should not return a response');
          })
          .catch(e => {
            expect(e.code).equal('ECONNRESET');
          });

        const typesNeeded = {
          header: 1,
          patch: patchEntries.length,
        };
        const {lines: logLines, linesNeeded} = await checks.waitForLines(typesNeeded);
        lastLogLines = logLines;

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
