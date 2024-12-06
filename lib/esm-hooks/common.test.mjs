import M from 'node:module';
import {expect} from 'chai';
import {mappings} from './common.mjs';

describe('esm-hooks common', function() {
  describe('mappings cover all builtin modules\' exports', function() {
    for (const [name, url] of Object.entries(mappings)) {
      it(`${name} mappings are complete`, async function() {
        // older versions of node don't have all the builtin modules
        const bareName = name.replace('node:', '');
        if (!M.builtinModules.includes(bareName)) {
          this.skip();
          return;
        }

        const redirectedImports = await import(url);
        const nativeImports = await import(name);

        const redirectedKeys = new Set(Object.keys(redirectedImports));
        const nativeKeys = new Set(Object.keys(nativeImports));

        const missing = new Set([...nativeKeys].filter(x => !redirectedKeys.has(x)));
        expect(missing.size).equal(0, `missing keys: [${[...missing].join(', ')}]`);
      });
    }
  });
});
