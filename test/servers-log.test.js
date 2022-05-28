'use strict';

const fsp = require('fs').promises;
const path = require('path');

const fetch = require('node-fetch');
const {expect} = require('chai');

const Server = require('./servers/server');
const {makeTestGenerator} = require('./servers/helpers');
const {checks, makeLogEntry} = require('./writer/checks');

const pdj = require('./servers/package.json');
// these are the log entries that are always present.
function getBaseLogEntries() {
  return [[
    makeLogEntry('header', pdj),
  ]];
}

const tests = makeTestGenerator({getBaseLogEntries});

const metricsEntries = [
  makeLogEntry('metrics'),
  makeLogEntry('metrics'),
  makeLogEntry('metrics'),
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

    const {server, base, desc, nodeArgs, appArgs} = t;
    t.logEntries = t.logEntries.concat(metricsEntries);

    describe(desc, function() {
      this.timeout(10000);
      let lastArgs;
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
          // eslint-disable-next-line no-console
          console.log('new Server(', lastArgs, ')');
        }
      });

      //
      // the tests start here
      //
      it('header and patch entries are present after startup', async function() {
        const subset = t.logEntries.filter(e => {
          return e.type === 'header' || e.type === 'patch';
        });
        await checks.waitForLinesAndCheck(subset);
      });

      it('post and get entries are present', async function() {
        const obj = {cat: 'tuna', dog: 'beef', snake: 'mouse'};

        await post(`${base}/echo`, obj);
        await post(`${base}/meta`, obj);
        await get(`${base}/info`);

        await checks.waitForLinesAndCheck(t.logEntries);
      });

      it('do not write a record if end() is not called', async function() {
        const expected = t.logEntries.slice();

        return post(`${base}/stop/0`, {})
          .then(() => {
            throw new Error('the server should not return a response');
          })
          .catch(e => {
            expect(e.code).equal('ECONNRESET');
          })
          .then(() => checks.waitForLinesAndCheck(expected));
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
