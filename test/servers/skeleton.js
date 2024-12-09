'use strict';

const defaultOptions = {
  protocols: {
    http: {host: 'localhost', port: 0}
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
      httpServer.listen(port, host, () => {
        this.protocols.http.port = httpServer.address().port;
        listening();
      });
    }

    if (this.https) {
      const fs = require('fs');
      const opts = {};
      opts.key = fs.readFileSync(`${__dirname}/../certs/server.key`, 'utf8');
      opts.cert = fs.readFileSync(`${__dirname}/../certs/server.cert`, 'utf8');
      const {host, port} = this.protocols.https;
      const httpsServer = this.https.createServer(opts, app);
      httpsServer.listen(port, host, () => {
        this.protocols.https.port = httpsServer.address().port;
        listening();
      });
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
  //let fakeTracker;
  //let fakeAgent;

  let agent;
  let tracker;

  const cmdLineAgent = process.execArgv.at(-1);

  if (cmdLineAgent === '@contrast/protect-agent') {
    const d = require('@contrast/distringuish');
    agent = {};
    tracker = {
      getData(s) {
        return d.getProperties(s);
      },
      getMetadata(s) {
        return d.getProperties(s);
      }
    };
  } else if (cmdLineAgent === '@contrast/agent') {
    const core = global[Symbol.for('contrast:core')];
    agent = core;
    tracker = core?.assess?.dataflow?.tracker;
  } else if (cmdLineAgent === '@contrast/rasp-v3') {
    agent = global.__contrast;
    tracker = agent?.tracking;
  }

  return {agent, tracker};
};

module.exports = ServerSkeleton;
