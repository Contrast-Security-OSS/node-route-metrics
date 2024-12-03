/*
 * Copyright: 2024 Contrast Security, Inc
 * Contact: support@contrastsecurity.com
 * License: Commercial

 * NOTICE: This Software and the patented inventions embodied within may only be
 * used as part of Contrast Security’s commercial offerings. Even though it is
 * made available through public repositories, use of this Software is subject to
 * the applicable End User Licensing Agreement found at
 * https://www.contrastsecurity.com/enduser-terms-0317a or as otherwise agreed
 * between Contrast Security and the End User. The Software may not be reverse
 * engineered, modified, repackaged, sold, redistributed or otherwise used in a
 * way not consistent with the End User License Agreement.
 */
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
