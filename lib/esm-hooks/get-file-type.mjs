import {readFile} from 'node:fs/promises';
import path from 'node:path';
import M from 'node:module';
import {fileURLToPath} from 'node:url';
import {findPackageJson} from '@contrast/find-package-json';

import primordials from '../primordials.mjs';
const {StringPrototypeSlice, JSONParse} = primordials;

const isBuiltin = M.isBuiltin || function(pathname) {
  if (pathname.startsWith('node:')) {
    pathname = StringPrototypeSlice.call(pathname, 5);
  }
  return M.builtinModules.includes(pathname);
};

/** @typedef { 'builtin' | 'commonjs' | 'module' } Format */

/**
 * @param {string | URL} filename
 * @param {import('@contrast/find-package-json').Options["stopAt"]=} stopAt
 * @returns {Promise<Format | null>}
 */
export async function getFileType(filename, stopAt) {
  try {
    filename = fileURLToPath(filename);
  } catch (err) {
    // already a path or node: url
  }

  if (isBuiltin(filename)) {
    return 'builtin';
  }

  // if the file extension specifies the type, there's no need to do extra IO.
  const ext = path.extname(filename);
  if (ext === '.mjs') {
    return 'module';
  } else if (ext === '.cjs') {
    return 'commonjs';
  }

  // Node assumes `commonjs` if `type` is not set in package.json
  let parentType = 'commonjs';
  try {
    const pkg = await findPackageJson({cwd: filename, stopAt});
    if (pkg) {
      const json = await readFile(pkg, 'utf8');
      const {type} = JSONParse(json);
      if (type) {
        parentType = type;
      }
    }
  } catch (err) {
    // not sure what errors can occur here. should consider logging.
  }

  if (ext === '.js') {
    return parentType;
  }

  // should this assume commonjs?
  return null;
}
