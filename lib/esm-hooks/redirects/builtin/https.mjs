const m = await import('node:module');
const require = m.createRequire(import.meta.url);
// does this get patched because it's being required?
const https = require('https');

export default https;

export const {
  Agent,
  globalAgent,
  Server,
  createServer,
  get,
  request,
} = https;
