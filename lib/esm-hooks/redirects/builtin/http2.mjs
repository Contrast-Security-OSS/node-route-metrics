const m = await import('node:module');
const require = m.createRequire(import.meta.url);
// does this get patched because it's being required?
const http2 = require('http2');

export default http2;

export const {
  Http2ServerRequest,
  Http2ServerResponse,
  connect,
  constants,
  createSecureServer,
  createServer,
  getDefaultSettings,
  getPackedSettings,
  getUnpackedSettings,
  performServerHandshake,
  sensitiveHeaders,
} = http2;
