'use strict';

const child_process = require('child_process');

class Server {
  constructor(args, options = {}) {
    this.args = args;
    this.options = options;
    this.cp = child_process.spawn('node', args, options);
    // add exitHandler function and exited promise to this.
    this.addExitHandling();
    this.readyPromise = new Promise((resolve, reject) => {
      this.cp.on('spawn', function() {
        // can't resolve because server/agent may not be ready.
      });

      this.cp.on('error', reject);
      this.cp.on('exit', (...args) => this.exitHandler(...args));
      this.havePid = false;
      this.cp.stdout.on('data', function(d) {
        const s = d.toString();
        if (this.havePid) {
          // this helps debug if there is a console log buried somewhere
          // eslint-disable-next-line no-console
          console.log('stdout:', s);
          return;
        }
        // wait to see the pid output. by test convention that's when
        // the callback of server.listen() has been called.
        if (/^\d+\n$/.test(s)) {
          this.havePid = true;
          resolve();
        } else {
          if (Server.isAgentStartupNoise(s)) {
            return;
          }
          reject(new Error(`unexpected output ${s.slice(0, -1)}`));
        }
      });
      this.cp.stderr.on('data', function(d) {
        const s = d.toString();
        // let's not see this over and over
        if (s.includes('Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to \'0\'')) {
          return;
        }
        // this helps debug if the servers have an error.
        // eslint-disable-next-line no-console
        console.log('stderr:', s);
      });
    });
  }

  //
  // stop the server. by convention, the server implements the
  // POST /stop/:code endpoint. this is because if running with
  // nyc the signal handling is messed up and servers are left
  // running.
  //
  // https://github.com/istanbuljs/nyc/issues/762
  //
  stop({type, value} = {type: 'signal', value: 'SIGTERM'}) {
    // if it didn't exit on its own, kill it.
    if (typeof this.exitCode !== 'number') {
      // if the type is an url then post to that url.
      if (type === 'url') {
        post(value, {});
      } else if (type === 'signal') {
        this.cp.kill(value);
      }
    }
    // return the exit handling promise. it will resolve as either
    // the exit code of the server process or the signal that killed
    // the server process.
    return this.exitedPromise;
  }

  getExitCode() {
    return this.exitCode;
  }

  addExitHandling() {
    this.exitCode = null;
    this.exitedPromise = new Promise((resolve, reject) => {
      this.exitHandler = (code, signal) => {
        if (code !== null) {
          this.exitCode = code;
          if (code === 0) {
            resolve(code);
          } else {
            reject(new Error(`unexpected exitCode: ${code}`));
          }
        } else {
          resolve(signal);
        }
      };
    });
  }

  static isAgentStartupNoise(s) {
    if (s.length === 1 && s === '\n') {
      // ignore blank lines
      return true;
    }
    if (/^@contrast\/agent \d+\.\d+\.\d+\n/.test(s)) {
      return true;
    }
    if (/--------------------------------------/.test(s)) {
      return true;
    }
    if (s.startsWith('The Contrast Node Agent collects usage data')) {
      return true;
    }

    return false;
  }

}

let fetch;

async function post(url, obj) {
  const options = {
    method: 'post',
    body: JSON.stringify(obj),
    headers: {'content-type': 'application/json'}
  };
  fetch = fetch || require('node-fetch');
  return fetch(url, options)
    .then(res => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      return res;
    })
    .then(res => res.json());
}


module.exports = Server;
