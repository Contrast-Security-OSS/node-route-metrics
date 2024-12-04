import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import primordials from '../primordials.mjs';
const { ArrayPrototypeJoin, StringPrototypeEndsWith } = primordials;

const REDIRECTS_PATH = './redirects';

export const mappings = await makeMappings();

export async function makeMappings() {
  const mappings = Object.create(null);

  // the name of the directory is the format of the target being loaded. so "cjs"
  // means the target is a commonjs module that will be loaded via require(),
  // "builtin" means the target is a builtin, and "esm" (when it's added) will
  // mean that the target is a native esm module.
  //
  // at this time, all "builtin" modules are "cjs" modules and can be required.
  // and all "cjs" modules are commonjs modules that can be required. The reason
  // they need to be here is that they might be loaded by the ESM loader in the
  // background thread, so we need to redirect them to the commonjs loader.
  //
  // all files in the "redirects" directory are .mjs files.
  //
  // 'esm' does not currently have any redirect files; there is one example file
  // for node-fetch, but it does not have the extension .mjs, so it won't be used.
  // 'esm' will be needed when we have to patch an esm-native file.
  for (const dir of ['builtin', 'cjs', 'esm']) {
    // keep track of recursive calls to handle nested directories, e.g., fs/promises
    const pathStack = [];

    // get an absolute path because reading the redirect file is going to be executed
    // in another context.
    const redirectsPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      REDIRECTS_PATH,
      dir,
    );

    await recursiveReaddir(redirectsPath);

    // eslint-disable-next-line no-inner-declarations
    async function recursiveReaddir(dirpath) {
      const dirents = await readdir(dirpath, { withFileTypes: true });
      for (const dirent of dirents) {
        if (dirent.isDirectory()) {
          const { name: subdir } = dirent;
          const subp = path.join(dirpath, subdir);
          pathStack.push(subdir);
          await recursiveReaddir(subp);
          pathStack.pop();
          continue;
        }
        if (!StringPrototypeEndsWith.call(dirent.name, '.mjs')) {
          continue;
        }
        // it's a file that ends with .mjs, so it's a redirect file.
        const redirectURL = pathToFileURL(path.join(dirpath, dirent.name));

        // all redirects point to .mjs files.
        // the 'csi-flag' query specifies the type of file that will be loaded
        // by the redirecting .mjs file:
        // e.g.,
        // 'node-fetch': 'file://.../redirects/esm/node-fetch.mjs?csi-flag=module`
        // 'fs/promises': 'file://.../redirects/builtin/fs/promises.mjs?csi-flag=builtin`,
        //
        // there is a separate builtin directory because putting a colon in a filename doesn't work on windows. so
        // that's why the mapping below adds the `node:` prefix.
        let name = path.basename(dirent.name, '.mjs');
        if (pathStack.length) {
          name = `${ArrayPrototypeJoin.call(pathStack, '/')}/${name}`;
        }

        // set flag to module or commonjs. i'm not sure this is needed but am keeping it
        // in place until we have to implement esm-native module rewrites/wrapping. this
        // is the point at which resolve() communicates to load().
        //
        // builtin's are probably the most likely to be loaded, so they're first.
        // some tweaks might be needed when we start to patch esm-native modules
        // in esm-native-code:
        // https://nodejs.org/docs/latest-v20.x/api/esm.html#builtin-modules
        // https://nodejs.org/docs/latest-v20.x/api/module.html#modulesyncbuiltinesmexports
        if (dir === 'builtin') {
          redirectURL.searchParams.set('csi-flag', 'builtin');
          mappings[name] = redirectURL.href;
          mappings[`node:${name}`] = redirectURL.href;
        } else if (dir === 'cjs') {
          redirectURL.searchParams.set('csi-flag', 'commonjs');
          mappings[name] = redirectURL.href;
        } else if (dir === 'esm') {
          redirectURL.searchParams.set('csi-flag', 'module');
          mappings[name] = redirectURL.href;
        } else {
          throw new Error(`target type ${dir} not yet implemented`);
        }
      }
    }
  }

  return mappings;
}
