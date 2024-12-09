'use strict';

const BaseChecker = require('./_base');

class RouteChecker extends BaseChecker {
  constructor(options = {}) {
    // minimal error checking, but both can't be specified.
    if (options.requiredEntries && options.routesToCheck) {
      throw new Error('cannot have both requiredEntries and routesToCheck');
    } else if (options.routesToCheck) {
      options.requiredEntries = options.routesToCheck.length;
    }

    super(Object.assign({}, options, {type: 'route'}));

    this.routesSeen = new Map();

    if (options.routesToCheck) {
      this.routesToCheck = options.routesToCheck;
    }

    // can be overridden by option on each routeToCheck, but these are the
    // defaults.
    this.allowDuplicates = options.allowDuplicates ?? false;
    this.allowUnknownRoutes = options.allowUnknownRoutes ?? true;
  }

  check(entry, context) {
    super.check(entry);

    const {method, url} = entry;
    const route = `${method} ${url}`;

    // worth checking format of route: et, host, method, port, protocol, start,
    // statusCode, url?

    if (this.routesToCheck) {
      for (let i = 0; i < this.routesToCheck.length; i++) {
        const {method: checkMethod, path} = this.routesToCheck[i];
        if (method === checkMethod && url === path) {
          this.addRouteToRoutesSeen(route);
          return;
        }
      }
    }
    // there may or may not have been routesToCheck, but if there were, this
    // route didn't match. if unknown routes are allowed, it's all good, but
    // if not, it's an error. this allows a test to verify that no routes are
    // present - just set {allowUnknownRoutes: false} with no routesToCheck.
    if (!this.allowUnknownRoutes) {
      throw new Error(`unknown route: ${route}`);
    }
  }

  addRouteToRoutesSeen(route) {
    const count = this.routesSeen.get(route);

    if (!count) {
      this.routesSeen.set(route, 1);
    } else if (this.allowDuplicates) {
      this.routesSeen.set(route, count + 1);
    } else {
      throw new Error(`duplicate route: ${route}`);
    }
  }
}

module.exports = RouteChecker;
