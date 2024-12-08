'use strict';

const os = require('os');
const shimmer = require('shimmer');
const metrics = require('../metrics-symbol');
const routeEmitter = require('../route-emitter');

//
// have to intercept all require calls but do as little as possible
// if not http.
//
function patch(m, options) {
  return patchServer(m, options.name);
}

//
// patch the http/https server object and return it.
//
function patchServer(m, protocol) {
  const proto = m.Server && m.Server.prototype;

  // if server or its prototype aren't there then there's nothing to do
  if (!proto) {
    throw new Error(`cannot find ${protocol}.Server.prototype`);
  }

  // wrap the emitter so metrics can be captured for requests
  shimmer.wrap(proto, 'emit', realEmitter => function(type, req, res) {
    //
    // handle "upgrade" requests? they don't return an http response, it's
    // basically a socket that a stream is written to. maybe wait for the
    // close on those at some point. but defer now.
    //
    // listen for 'request' events and patch the request object.
    if (type !== 'request') {
      return realEmitter.apply(this, arguments);
    }

    res[metrics] = getMetrics(req);
    // supply a default port if none was specified
    if (!res[metrics].port) {
      res[metrics].port = protocol === 'http' ? 80 : 443;
    }

    shimmer.wrap(res, 'end', fn => function() {
      // run metrics exit code
      if (res[metrics]) {
        const m = res[metrics];
        // convert elapsed time and start time to microseconds
        m.et = Number((process.hrtime.bigint() + 500n) / 1000n - m.start);
        m.start = Number(m.start);
        m.statusCode = res.statusCode;
        m.protocol = protocol;
        routeEmitter.emit('route', m);
        // delete the metrics after emitting; some frameworks call end()
        // more than once.
        delete res[metrics];
      }
      // Run the real end function
      return fn.apply(this, arguments);
    });

    return realEmitter.apply(this, arguments);
  });

  return m;
}


function getMetrics(req) {
  const [host, port] = getHostAndPort(req);
  const metrics = {
    method: req.method,
    host,
    port,
    url: req.url,
    start: (process.hrtime.bigint() + 500n) / 1000n,
  };
  return metrics;
}

function getHostAndPort(req) {
  let host;
  let port;
  ({host} = req.headers);
  if (!host) {
    host = os.hostname();
  }
  [host, port] = host.split(':');

  if (port) {
    port = Number(port);
  }
  return [host, port];
}

module.exports = patch;
