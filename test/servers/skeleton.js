'use strict';

const defaultOptions = {
  protocols: {
    http: {host: 'localhost', port: 8888}
  }
};

class ServerSkeleton {
  constructor(app, options = defaultOptions) {
    this.app = app;
    this.options = options;
    this.protocols = options.protocols;

    this.serverCount = 0;
    this.http = undefined;
    this.https = undefined;
    for (const protocol in this.protocols) {
      if (['http', 'https'].indexOf(protocol) >= 0) {
        this[protocol] = require(protocol);
        this.serverCount += 1;
      }
    }

    if (!this.serverCount) {
      throw new Error('neither http nor https specified');
    }
  }

  getApp() {
    return this.app;
  }

  async start() {
    let started = 0;
    let res;
    const p = new Promise((resolve, reject) => {
      res = resolve;
    });
    // kind of sucks but make garbage collection happen faster so testing
    // doesn't take forever. this is especially needed for tests that just
    // wait for gc to appear.
    // eslint-disable-next-line no-unused-vars
    let buffer;
    const interval = setInterval(function() {
      buffer = Buffer.alloc(1000000);
    }, 50);
    interval.unref();

    const listening = () => {
      started += 1;
      if (started >= this.serverCount) {
        res(this.serverCount);
        this.serverCount = Infinity;
      }
    };

    const app = this.getApp();

    if (this.http) {
      const {host, port} = this.protocols.http;
      const httpServer = this.http.createServer(app);
      httpServer.listen(port, host, listening);
    }

    if (this.https) {
      const fs = require('fs');
      const opts = {};
      opts.key = fs.readFileSync(`${__dirname}/../certs/server.key`, 'utf8');
      opts.cert = fs.readFileSync(`${__dirname}/../certs/server.cert`, 'utf8');
      const {host, port} = this.protocols.https;
      const httpsServer = this.https.createServer(opts, app);
      httpsServer.listen(port, host, listening);
    }

    return p;
  }
}

//
// a helper for the command line.
//
// @throws on error
//
ServerSkeleton.getProtocols = function(args) {
  const protocols = {};
  let i = 0;
  while (i < args.length) {
    const [protocol, host, port] = args[i].split(':');
    if (!protocol || !host || !port) {
      throw new Error(`${args[i]} missing protocol, host, and/or port`);
    }
    protocols[protocol] = {host, port: Number(port)};

    i += 1;
  }
  return protocols;
};

//
// helper for getting the the agent-specific global object and components
//
ServerSkeleton.getAgentGlobals = function() {
  let fakeTracker;
  let fakeAgent;
  // detect @contrast/protect-agent (node-mono) via this check
  if (process.execArgv[process.execArgv.length - 1] === '@contrast/protect-agent') {
    try {
      const d = require('@contrast/distringuish');
      fakeAgent = {};
      fakeTracker = {
        getData(s) {
          return d.getProperties(s);
        },
        getMetadata(s) {
          return d.getProperties(s);
        }
      };
    } catch (e) {
      // ignore
    }
  }

  const {
    __contrast: raspAgent,
    contrast_agent: nodeAndProtectAgent,
    contrast_tracker: nodeAndProtectTracker
  } = global;

  const raspTracker = raspAgent?.tracking;

  const agent = raspAgent || nodeAndProtectAgent || fakeAgent;
  const tracker = raspTracker || nodeAndProtectTracker || fakeTracker;

  return {agent, tracker};
};

module.exports = ServerSkeleton;
