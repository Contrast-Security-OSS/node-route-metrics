'use strict';

const {expect} = require('chai');
const semver = require('semver');

const BaseChecker = require('./_base');

const nodeIsGreaterThanV20 = semver.satisfies(process.version, '>=20.0.0');
const nodeIsLessThanV18dot19 = semver.satisfies(process.version, '<18.19.0');

class PatchChecker extends BaseChecker {
  constructor(options) {
    super(Object.assign({}, options, {type: 'patch'}));

    const {requiredPatches = [], ...otherOptions} = options;
    this.staticRequiredPatches = requiredPatches.slice();
    this.requiredPatches = requiredPatches.slice();

    const {
      nonRequiredPatchesAllowed = false,
      duplicatesAllowed = false
    } = otherOptions;
    this.nonRequiredPatchesAllowed = nonRequiredPatchesAllowed;
    this.duplicatesAllowed = duplicatesAllowed;
  }

  check(entry) {
    super.check(entry);

    const {name} = entry;
    if (!this.requiredPatches.length) {
      return;
    }

    if (this.requiredPatches.includes(name)) {
      // remove the patch from the list - option to allow duplicates if needed
      this.requiredPatches.splice(this.requiredPatches.indexOf(name), 1);
      return;
    }

    // it's not a required patch. are non-required patches allowed?
    if (this.nonRequiredPatchesAllowed) {
      return;
    }

    // no, they're not allowed.
    expect(this.staticRequiredPatches).includes(name);
  }

  getNumberOfRequiredEntries() {
    return this.staticRequiredPatches.length;
  }

  static getMinimalPatchEntries(t) {
    // it's impossible to have a server without http; even https requires it.
    const patchNames = [];

    // the expected sequence of patches is specific to each combination of agent and
    // express. N.B. as of node 16.19.1, the agent cannot be detected by route-metrics,
    // because it is being loaded via the '-r' or '--request' command line option. so
    // it is being detected by looking at process.execArgv when the first module in the
    // @contrast scope is loaded.
    if (t.agentPresent === '@contrast/agent') {
      patchNames.push('http');
      //
      // http and https (since the agent started using axios) are always required
      // by the node agent even if the server doesn't use https.
      //
      // for some reason we do not see get a chance to patch https when the agent
      // is loaded by node v18.19.0 up to 20.0.0. i think this is because the
      // tests use --import to load route-metrics and the agent and that can load
      // in a background thread. there is no fix for this short of updating
      // route-metrics with esm support.
      //
      // perversely, even if https is not specified, it gets loaded by axios
      // which @contrast/agent uses, so it's always present when the agent is.
      if (t.loadProtos.includes('https')) {
        // if the server is going to load https it will always be present
        patchNames.push('https');
      } else {
        // the server doesn't load, only the agent. so the weird node-version
        // exclusion is needed.
        if (nodeIsGreaterThanV20 || nodeIsLessThanV18dot19) {
          patchNames.push('https');
        }
      }
      // the agent should be present too.
      patchNames.push(t.agentPresent);
    } else if (!t.agentPresent) {
      //
      // no agent, so http and/or https are the only patch entries.
      //
      // both the node-agent and express require http, so it will be present
      const expressPresent = t.server === 'express.cjs' || t.server === 'express.mjs';
      if (t.loadProtos.includes('http') || expressPresent) {
        patchNames.push('http');
      }
      if (t.loadProtos.includes('https')) {
        patchNames.push('https');
      }
    } else {
      // this used to support rasp-v3, but that's been removed.
      throw new Error(`unexpected agentPresent value: ${t.agentPresent}`);
    }

    return patchNames;
  }
}

module.exports = PatchChecker;
