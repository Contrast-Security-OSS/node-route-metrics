
import cp from 'node:child_process';
import assert from 'node:assert';
import fsp from 'node:fs/promises';

describe('log-processor - stdout', function() {
  const files = [
    'minimal-route-metrics.log',
    'nrwb-route-metrics.log',
  ];

  for (const file of files) {
    let results;

    it(`${file}: read/process with default reporter`, async function() {
      results = cp.spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`]);

      assert.strictEqual(results.status, 0);
    });

    it(`${file}: read/process specifying csv reporter`, async function() {
      const previous = results.stdout.toString();

      const env = Object.assign({}, process.env, {CSI_RM_REPORTER: 'csv'});
      results = cp.spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.strictEqual(results.status, 0);
      assert.strictEqual(results.stdout.toString(), previous);
    });

    it(`${file}: csv & csv-deprecated are the same`, async function() {
      const previous = results.stdout.toString();

      const env = Object.assign({}, process.env, {CSI_RM_REPORTER: 'csv2'});
      results = cp.spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.strictEqual(results.status, 0);
      assert.strictEqual(results.stdout.toString(), previous);
    });

    it(`${file}: read/process with json reporter`, async function() {
      const env = Object.assign({}, process.env, {CSI_RM_REPORTER: 'json'});
      results = cp.spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.strictEqual(results.status, 0);
    });

    it(`${file}: json & json-deprecated are the same`, async function() {
      const previous = results.stdout.toString();
      const env = Object.assign({}, process.env, {CSI_RM_REPORTER: 'json-deprecated'});
      results = cp.spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.strictEqual(results.status, 0);
      const newResults = results.stdout.toString();
      assert.strictEqual(newResults.length, previous.length);
      assert.strictEqual(results.stdout.toString(), previous);
    });
  }
});

describe('log-processor - file', function() {
  const files = [
    'minimal-route-metrics.log',
    'nrwb-route-metrics.log',
  ];

  for (const file of files) {
    let results;
    let expected;

    it(`${file}: read/process with default reporter`, async function() {
      const env = Object.assign({}, process.env, {CSI_RM_OUTPUT: 'output-1'});
      results = cp.spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.notStrictEqual(results, null);
      assert.ok(!results.error);
      assert.strictEqual(results.status, 0);
      expected = await fsp.readFile('output-1', 'utf8');
    });

    it(`${file}: read/process specifying csv reporter`, async function() {
      const previous = results.stdout.toString();

      const env = Object.assign({}, process.env, {CSI_RM_REPORTER: 'csv', CSI_RM_OUTPUT: 'output-2'});
      results = cp.spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.notStrictEqual(results, null);
      assert.ok(!results.error);
      assert.strictEqual(results.status, 0);
      assert.strictEqual(results.stdout.toString(), previous, 'stdout does not match');

      const contents = await fsp.readFile('output-2', 'utf8');
      assert.strictEqual(contents, expected, 'files do not match');
    });

    it(`${file}: csv & csv-deprecated are the same`, async function() {
      const previous = results.stdout.toString();

      const env = Object.assign({}, process.env, {CSI_RM_REPORTER: 'csv-deprecated', CSI_RM_OUTPUT: 'output-2'});
      results = cp.spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.notStrictEqual(results, null);
      assert.ok(!results.error);
      assert.strictEqual(results.status, 0);
      assert.strictEqual(results.stdout.toString(), previous, 'stdout does not match');

      const contents = await fsp.readFile('output-2', 'utf8');
      assert.strictEqual(contents, expected, 'files do not match');
    });

    it(`${file}: read/process with json reporter`, async function() {
      const env = Object.assign({}, process.env, {CSI_RM_REPORTER: 'json', CSI_RM_OUTPUT: 'output-1'});
      results = cp.spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.notStrictEqual(results, null);
      assert.ok(!results.error);
      assert.strictEqual(results.status, 0);

      expected = await fsp.readFile('output-1', 'utf8');
    });

    it(`${file}: json & json-deprecated are the same`, async function() {
      const previous = results.stdout.toString();
      const env = Object.assign({}, process.env, {CSI_RM_REPORTER: 'json-deprecated', CSI_RM_OUTPUT: 'output-2'});
      results = cp.spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.notStrictEqual(results, null);
      assert.ok(!results.error);
      assert.strictEqual(results.status, 0);
      assert.strictEqual(results.stdout.toString(), previous, 'stdout does not match');

      const contents = await fsp.readFile('output-2', 'utf8');
      assert.strictEqual(contents, expected, 'files do not match');
    });
  }
});
