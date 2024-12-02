import { expect } from 'chai';
import * as sinon from 'sinon';
import component from './debug-methods.mjs';

function mockCore () {
  return { esmHooks: {} };
}

describe('esm-hooks debug-methods', function() {
  it('doesn\'t append debug methods to core.esmHooks if mask is 0', function() {
    const core = mockCore();
    component(core, { mask: 0, install: false });
    expect(core.esmHooks).to.be.empty.and.an('object');
  });

  [
    {
      mask: 1,
      expected: [
        /CJS\(\d\) _load\(\) request/,
        /ESM\(\d\) initialize\(\) specifier/,
        /ESM\(\d\) load\(\) url/,
      ]
    },
    {
      mask: 3,
      expected: [
        /CJS\(\d\) _load\(\) request/,
        /ESM\(\d\) initialize\(\) specifier/,
        /ESM\(\d\) resolve\(\) specifier/,
        /ESM\(\d\) load\(\) url/,
      ]
    },
    {
      mask: 7,
      expected: [
        /CJS\(\d\) _compile\(\) filename/,
        /CJS\(\d\) extensions\.js\(\) filename/,
        /CJS\(\d\) _load\(\) request/,
        /CJS\(\d\) require\(\) moduleId/,
        /ESM\(\d\) initialize\(\) specifier/,
        /ESM\(\d\) resolve\(\) specifier/,
        /ESM\(\d\) load\(\) url/,
      ],
    },
  ].forEach(({
    mask,
    expected
  }) => {
    describe(`mask = ${mask}`, function() {
      let core;

      function callMethods() {
        core.esmHooks.debugCjsCompile('filename');
        core.esmHooks.debugCjsExtensions('filename');
        core.esmHooks.debugCjsLoad('request');
        core.esmHooks.debugCjsRequire('moduleId');
        core.esmHooks.debugEsmInitialize('specifier');
        core.esmHooks.debugEsmResolve('specifier');
        core.esmHooks.debugEsmLoad('url');
      }

      before(async function() {
        core = { esmHooks: {} };
        component(core, { mask, install: false });
        sinon.stub(core.esmHooks, '_rawDebug');
      });

      after(function() {
        sinon.restore();
      });

      it('logs appropriate messages based on mask value', function() {
        callMethods();

        expect(core.esmHooks._rawDebug).to.have.callCount(expected.length);
        for (const rx of expected) {
          expect(core.esmHooks._rawDebug).to.have.been.calledWithMatch(sinon.match(rx));
        }
      });
    });
  });
});
