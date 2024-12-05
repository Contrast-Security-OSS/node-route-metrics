import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const http = require('node:http');

export default http;

export const {
  _connectionListener,
  METHODS,
  STATUS_CODES,
  Agent,
  ClientRequest,
  IncomingMessage,
  OutgoingMessage,
  Server,
  ServerResponse,
  createServer,
  validateHeaderName,
  validateHeaderValue,
  get,
  request,
  setMaxIdleHTTPParsers,
  maxHeaderSize,
  globalAgent,
  CloseEvent,
  MessageEvent,
  WebSocket
} = http;
