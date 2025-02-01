
import cp from 'node:child_process';
import assert from 'node:assert';
import fsp from 'node:fs/promises';
import os from 'node:os';

import expected from '../../test/log-files/expected.mjs';

let desc = describe;
if (os.type() === 'os-you-want-to-skip') {
  desc = describe.skip;
}

function spawnSync(...rest) {
  const results = cp.spawnSync(...rest);
  if (results.stderr) {
    const stderr = results.stderr.toString();
    if (!stderr.includes('xyxxy.x')) {
      // eslint-disable-next-line no-console
      console.error(results.stderr.toString());
    }
  }
  return results;
}

desc('log-processor - stdout', function() {
  const files = [
    'minimal-route-metrics.log',
    'nrwb-route-metrics.log',
  ];

  for (const file of files) {
    let results;

    it(`${file}: read/process with default reporter (csv)`, async function() {
      results = spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`]);

      assert.strictEqual(results.status, 0);
      const stdout = results.stdout.toString();
      assert.equal(stdout, expected.csv.stdout[file], 'stdout does not match');
    });

    it(`${file}: read/process specifying csv reporter`, async function() {
      const env = Object.assign({}, process.env, {CSI_RM_REPORTER: 'csv'});
      results = spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.strictEqual(results.status, 0);
      const stdout = results.stdout.toString();
      assert.strictEqual(stdout, expected.csv.stdout[file], 'stdout does not match');
    });

    it(`${file}: read/process with json reporter`, async function() {
      const env = Object.assign({}, process.env, {CSI_RM_REPORTER: 'json'});
      results = spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.strictEqual(results.status, 0);
      const stdout = results.stdout.toString().replaceAll(os.EOL, '\n');
      assert.strictEqual(stdout, expected.json.stdout[file], 'stdout does not match');
    });
  }
});

desc('log-processor - file', function() {
  const files = [
    'minimal-route-metrics.log',
    'nrwb-route-metrics.log',
  ];

  for (const file of files) {
    it(`${file}: read/process with default reporter`, async function() {
      const env = Object.assign({}, process.env, {CSI_RM_OUTPUT: 'output-1'});
      const results = spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.notStrictEqual(results, null);
      assert.ok(!results.error);
      assert.strictEqual(results.status, 0);

      const stdout = results.stdout.toString();
      assert.strictEqual(stdout, expected.csv.fileStdout[file], 'stdout does not match');

      const written = await fsp.readFile('output-1', 'utf8');
      assert.equal(written, expected.csv.file[file], 'files do not match');
    });

    it(`${file}: read/process specifying csv reporter`, async function() {
      const env = Object.assign({}, process.env, {CSI_RM_REPORTER: 'csv', CSI_RM_OUTPUT: 'output-2'});
      const results = spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.notStrictEqual(results, null);
      assert.ok(!results.error);
      assert.strictEqual(results.status, 0);

      const stdout = results.stdout.toString();
      assert.strictEqual(stdout, expected.csv.fileStdout[file], 'stdout does not match');

      const written = await fsp.readFile('output-2', 'utf8');
      assert.strictEqual(written, expected.csv.file[file], 'files do not match');
    });

    it(`${file}: read/process with json reporter`, async function() {
      const env = Object.assign({}, process.env, {CSI_RM_REPORTER: 'json', CSI_RM_OUTPUT: 'output-1'});
      const results = spawnSync('node', ['lib/log-processor/index.mjs', `./test/log-files/${file}`], {env});

      assert.notStrictEqual(results, null);
      assert.ok(!results.error);
      assert.strictEqual(results.status, 0);

      const stdout = results.stdout.toString();
      assert.strictEqual(stdout, '', 'stdout does not match');

      const written = await fsp.readFile('output-1', 'utf8');
      assert.equal(written, expected.json.file[file], 'files do not match');
    });
  }
});
