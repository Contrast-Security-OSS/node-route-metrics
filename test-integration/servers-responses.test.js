'use strict';

const fetch = require('node-fetch');
const {expect} = require('chai');

const Server = require('../test/servers/server');
const {makeTestGenerator} = require('../test/helpers');

const tests = makeTestGenerator({useEmptyNodeArgs: true});

//
// verify that the server is able to respond correctly with different
// configurations loaded.
//
describe('server response tests', function() {
  //
  // define the tests using the generator
  //
  for (const t of tests()) {
    const {server, appArgs, base} = t;

    const previousTLS = !!process.env.NODE_TLS_REJECT_UNAUTHORIZED;

    describe(t.desc, function() {
      let testServer;
      let lastArgs;
      this.timeout(10000);
      //
      // start the server
      //
      before(async function() {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
        const options = {env: Object.assign({}, process.env, t.env)};
        const nodeargs = [...t.nodeArgs, `./test/servers/${server}`, ...appArgs];
        lastArgs = nodeargs;
        testServer = new Server(nodeargs, options);
        return testServer.readyPromise;
      });

      after(async function() {
        if (!previousTLS) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }
        // if it didn't exit on its own, kill it.
        return testServer.stop({type: 'signal', value: 'SIGKILL'});
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
      it('should echo an object', async function() {
        const obj = {cat: 'tuna', dog: 'beef', snake: 'mouse'};

        return post(`${base}/echo`, obj)
          .then(result => {
            expect(result).eql(obj);
          });
      });

      it('should return metadata', async function() {
        const obj = {texas: 'dallas', maryland: 'baltimore', massachusetts: 'boston'};
        const s = JSON.stringify(obj);

        return post(`${base}/meta`, obj)
          .then(result => {
            expect(result.bytes).equal(s.length, 'wrong byte count');

            if (t.agentPresent) {
              expect(result.agent).equal(true, 'agent should be loaded');
              expect(result.tracker).equal(true, 'tracker should be present');
              // the released version of rasp-v3 does not have JSON string tracking, which
              // this depends on. needs a new release of rasp-v3.
              if (server === 'express' && t.agentPresent !== '@contrast/rasp-v3') {
                expect(result.tracked).equal(server === 'express', 'the data should be tracked');
              }
            } else {
              expect(result).property('agent').false;
              expect(result).property('tracker').false;
              expect(result.tracked).not.exist;
            }
          });
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

// eslint-disable-next-line no-unused-vars
function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
