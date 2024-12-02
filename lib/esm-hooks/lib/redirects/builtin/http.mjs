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
import { createRequire } from 'node:module';
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
