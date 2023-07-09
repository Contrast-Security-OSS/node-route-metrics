'use strict';

const Server = require('./skeleton');

const {
  __contrast: raspAgent,
  contrast_agent: nodeAndProtectAgent,
  contrast_tracker: nodeAndProtectTracker
} = global;

const raspTracker = raspAgent?.tracking;

const agent = raspAgent || nodeAndProtectAgent;
const tracker = raspTracker || nodeAndProtectTracker;

function app(req, res) {
  res.statusCode = 200;
  res.setHeader('content-type', 'text/plain');

  let body = '';

  req.on('data', function(chunk) {
    body += chunk;
  });
  req.on('end', () => dispatch(req, res, body));

  req.on('error', (e) => {
    // eslint-disable-next-line no-console
    console.log(e);
  });
}

function dispatch(req, res, body) {
  const protocol = req.socket.encrypted ? 'https' : 'http';
  const url = new URL(req.url, `${protocol}://${req.headers.host}`);

  if (req.method === 'POST') {

    if (url.pathname === '/echo') {
      body = JSON.parse(body);
      res.end(JSON.stringify(body));
      return;
    }

    if (url.pathname === '/read') {
      body = JSON.parse(body);
      const keys = Object.keys(body);
      for (const k in keys) {
        const x = body[k];
        if (x === 'xyzzy') {
          body[k] = x.repeat(2);
        }
      }
      res.end(JSON.stringify({referenced: keys.length}));
      return;
    }

    if (url.pathname === '/meta') {
      const t_start = Date.now();
      body = JSON.parse(body);
      const s = JSON.stringify(body);
      const response = {
        url: `${protocol}://${req.headers.host}`,
        bytes: s.length,
        stringifyTime: Date.now() - t_start,
        agent: !!agent,
        tracker: !!tracker,
      };
      if (tracker) {
        response.tracked = !!(tracker.getData || tracker.getMetadata)(s);
      }
      res.end(JSON.stringify(response));
      return;
    }

    if (url.pathname.startsWith('/stop/')) {
      const code = +url.pathname.slice('/stop/'.length);
      process.exit(code);
      return;
    }
  } else if (req.method === 'GET') {
    if (url.pathname === '/info') {
      res.end(JSON.stringify({info: {useful: 'things'}}));
      return;
    }

    if (url.pathname.startsWith('/wait/')) {
      const time = +url.pathname.slice('/wait/'.length);
      setTimeout(() => {
        res.end(JSON.stringify({waited: time}));
      }, time);
      return;
    }

  }

  res.statusCode = 404;
  res.end(`${JSON.stringify(url, null, 2)}\n`);
}

let options;
if (process.argv.length > 2) {
  const protocols = Server.getProtocols(process.argv.slice(2));
  options = {protocols};
}
const server = new Server(app, options);

server.start()
  .then(n => {
    // eslint-disable-next-line no-console
    console.log(process.pid);
  });

