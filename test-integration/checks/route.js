'use strict';


class RouteChecker {
  constructor(options = {}) {
    this.type = 'route';
    this.routesExpected = options.routesExpected || 0;
    this.routeEntryCount = 0;
  }

  getCountOfRequiredEntries() {
    return this.routesExpected;
  }

  check(entry) {
    // we could check the entry but we won't get here unless it's a route, so
    // until we add specific route-matching, there's no need.
    this.routeEntryCount += 1;
  }

  getRouteEntryCount() {
    return this.routeEntryCount;
  }
}

module.exports = RouteChecker;
