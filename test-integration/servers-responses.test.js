'use strict';

const {expect} = require('chai');

const Server = require('../test/servers/server');
const {makeTestGenerator} = require('./_helpers');

const tests = makeTestGenerator({useEmptyNodeArgs: true});

//
// verify that the server is able to respond correctly with different
// configurations loaded.
//
describe('server response tests', function() {
  //
  // iterate through the tests produced by the generator
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

        return testServer.post(`${base}/echo`, obj)
          .then(result => {
            expect(result).eql(obj);
          });
      });

      it('should return metadata', async function() {
        const obj = {texas: 'dallas', maryland: 'baltimore', massachusetts: 'boston'};
        const s = JSON.stringify(obj);

        return testServer.post(`${base}/meta`, obj)
          .then(result => {
            expect(result.bytes).equal(s.length, 'wrong byte count');

            if (t.agentPresent) {
              expect(result.agent).equal(true, 'agent should be loaded');
              expect(result.tracker).equal(true, 'tracker should be present');

              // only rasp-v3 tracks the object itself. is this correct?
              const expected = server === 'express' && t.agentPresent === '@contrast/rasp-v3';
              expect(result.tracked).equal(expected, 'the data should be tracked');
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
