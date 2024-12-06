import {expect} from 'chai';
import path from 'path';
import {getFileType} from './get-file-type.mjs';
import {fileURLToPath, pathToFileURL} from 'url';

describe('esm-hooks get-file-type', function() {
  it('handles URLs', async function() {
    const filename = pathToFileURL('/path/to/filename.js');
    expect(await getFileType(filename)).to.equal('commonjs');
  });

  it('handles file URL strings', async function() {
    const filename = pathToFileURL('/path/to/filename.js').href;
    expect(await getFileType(filename)).to.equal('commonjs');
  });

  it('returns builtin for node builtins', async function() {
    expect(await getFileType('node:child_process')).to.equal('builtin');
  });

  it('returns null when it cannot determine what the file is', async function() {
    expect(await getFileType('node:xyzzy')).to.equal(null);
  });

  it('returns null when the filename is not valid', async function() {
    expect(await getFileType('')).to.equal(null);
  });

  it('returns module when filename extension is .mjs', async function() {
    expect(await getFileType('filename.mjs')).to.equal('module');
  });

  it('returns module when filename extension is .js and parent type = module', async function() {
    const pathToEsmApp = path.resolve(
      fileURLToPath(import.meta.url),
      '../../../test/esm-app/index.js',
    );

    expect(await getFileType(pathToEsmApp)).to.equal('module');
  });

  it('stops searching when it reaches a provided stopAt', async function() {
    const pathToEsmApp = path.resolve(
      fileURLToPath(import.meta.url),
      '../../../test/esm-app/index.js',
    );

    expect(await getFileType(pathToEsmApp, path.dirname(pathToEsmApp))).to.equal('commonjs');
  });

  it('returns commonjs when filename extension is .cjs', async function() {
    expect(await getFileType('filename.cjs')).to.equal('commonjs');
  });

  it('returns commonjs when filename extension is .js and parent type != module', async function() {
    const pathToApp = path.resolve(
      fileURLToPath(import.meta.url),
      '../../../test/app/lib/index.js',
    );

    expect(await getFileType(pathToApp)).to.equal('commonjs');
  });

  it('returns null if unable to parse filename', async function() {
    expect(await getFileType('filename.json')).to.equal(null);
  });
});
