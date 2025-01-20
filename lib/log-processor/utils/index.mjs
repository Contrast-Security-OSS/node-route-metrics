import {createHistogram} from 'node:perf_hooks';

import TypeHeader from './types/typeHeader.mjs';
import TypeProc from './types/typeProc.mjs';
import TypeGc from './types/typeGc.mjs';
import TypeEventloop from './types/typeEventloop.mjs';
import TypePatch from './types/typePatch.mjs';
import TypeLoad from './types/typeLoad.mjs';
import TypeRoute from './types/typeRoute.mjs';
import TypeStatus from './types/typeStatus.mjs';

export default class RouteMetricsResults {
  //
  // invoke with the logObjects from a route-metrics log file.
  //
  constructor(logObjects, options = {}) {
    logObjects.sort((a, b) => a.ts - b.ts);
    this.logObjects = logObjects;
    // type 'route'
    this.routesIndex = Object.create(null);
    // every type other than 'route'
    this.typesIndex = Object.create(null);

    //
    this.foldRules = options.routeFoldRules || [];

    // route-specific behavior: route, patch, load, status, proc, gc, eventloop, ?
    this.header = this.typesIndex.header = new TypeHeader();
    this.proc = this.typesIndex.proc = new TypeProc();
    this.gc = this.typesIndex.gc = new TypeGc();
    this.eventloop = this.typesIndex.eventloop = new TypeEventloop();
    this.patch = this.typesIndex.patch = new TypePatch();
    this.load = this.typesIndex.load = new TypeLoad();
    this.route = this.typesIndex.route = new TypeRoute();
    this.status = this.typesIndex.status = new TypeStatus();


    // the earliest and latest routes
    this.earliestRoute = {ts: Infinity};
    this.latestRoute = {ts: 0};

    // create the indexes and find the earliest and latest timestamps.
    this.preprocess();
  }

  //
  // - build an index by route name. a name is defined by 'METHOD path'. locust
  // names are where the path is found, but they sometimes have a description,
  // e.g., '/api/users (register)', so this combines the method and name after
  // truncating the name at the first space.
  //
  // - add the route key to the route object
  //
  // - find the earliest and latest timestamps in locust output. this is the
  // only way to estimate the start and end times of the locust run.
  //
  preprocess() {
    for (const logObject of this.logObjects) {
      // routes get indexed by a key that depends elements of the url and
      // whether the user specifies fold rules. fold rules are used to merge
      // multiple urls into a single name, e.g., /api/users/1, /api/users/2.
      //
      // routes are also stored like any other type, but no other types are
      // handled multiple ways like routes.
      //
      // TODO NODE-3712 currently implemented in route-metrics log-processor
      // but should be here
      if (logObject.type === 'route') {
        let url = logObject.entry.url;
        for (const foldRule of this.foldRules) {
          if (foldRule.pat.test(logObject.entry.url)) {
            url = foldRule.fold;
            break;
          }
        }
        const routeKey = RouteMetricsRoute.makeKey(logObject.entry.method, url);
        let route = this.routesIndex[routeKey];
        if (!route) {
          route = new RouteMetricsRoute(logObject.entry.method, routeKey, logObject.entry.url);
          this.routesIndex[routeKey] = route;
        }
        route.add(logObject);
      } else if (logObject.type === 'unknown-config-items') {
        continue;
      }

      // add routes into a single type index in addition to all other types.
      // this makes it easier to find all the routes within a time range.
      //
      // maybe these different types will require different handling (e.g.,
      // summation of CPU, GC, etc.) but not needed yet, so defer).
      const type = this.typesIndex[logObject.type];
      if (!type) {
        throw new Error(`no instance for ${logObject.type}`);
      }
      type.add(logObject);
    }

    // all log objects have been processed, so let's calculate the earliest and
    // latest timestamps for all route activity.
    for (const route of Object.values(this.routesIndex)) {
      if (route.earliest.ts < this.earliestRoute.ts) {
        this.earliestRoute = route.earliest;
      }
      if (route.latest.ts > this.latestRoute.ts) {
        this.latestRoute = route.latest;
      }
    }
  }

  makeRouteKey(route) {
    return `${route.method} ${route.name.split(' ')[0]}`;
  }

  getRouteKeys() {
    return Object.keys(this.routesIndex);
  }

  getRoute(routeKey) {
    return this.routesIndex[routeKey];
  }

  getEntryTypes() {
    return Object.keys(this.typesIndex);
  }

  getEntry(type) {
    return this.typesIndex[type];
  }

  get earliestTimestamp() {
    return this.logObjects[0].ts;
  }

  get latestTimestamp() {
    return this.logObjects.at(-1).ts;
  }

  *iterateRoutes() {
    for (const route of Object.values(this.routesIndex)) {
      yield route;
    }
  }
}

export async function readRouteMetricsLog(filepath) {
  const fs = await import('node:fs');
  const rmLogText = await fs.promises.readFile(filepath, 'utf8');

  // convert the route metrics log entries to objects. we want to fail quickly if
  // there is a problem, so verify it starts with a header.
  const logObjects = rmLogText.split('\n').slice(0, -1).map(JSON.parse);
  if (logObjects[0].type !== 'header') {
    throw new Error(`route-metrics log must start with a header entry, not ${logObjects[0].type}`);
  }

  return logObjects;
}

//
// class to hold the route metrics logObjects for a single route.
//
class RouteMetricsRoute {
  static makeKey(method, url) {
    return `${method} ${url}`;
  }

  constructor(method, key, url) {
    this.key = key;
    this.method = method;
    this.url = url;
    this.logObjects = [];
    this.min = Infinity;
    this.max = 0;
    this.totalEt = 0;
    this._successCount = null;
    this.histogram = createHistogram();
  }

  add(logObject) {
    this.logObjects.push(logObject);
    this.totalEt += logObject.entry.et;
    this.min = Math.min(this.min, logObject.entry.et);
    this.max = Math.max(this.max, logObject.entry.et);
    this.histogram.record(logObject.entry.et);
  }

  get earliestTimestamp() {
    return this.logObjects[0].ts;
  }

  get latestTimestamp() {
    return this.logObjects.at(-1).ts;
  }

  get earliest() {
    return this.logObjects[0];
  }
  get latest() {
    return this.logObjects.at(-1);
  }

  get count() {
    return this.logObjects.length;
  }

  get successCount() {
    if (this._successCount === null) {
      this._successCount = 0;
      for (const logObject of this.logObjects) {
        if (logObject.entry.statusCode < 400) {
          this._successCount += 1;
        }
      }
    }

    return this._successCount;
  }

  get mean() {
    return this.totalEt / this.count;
  }

  makePercentiles(percentiles = [50, 75, 90, 95, 99]) {
    return percentiles.map(p => this.histogram.percentile(p));
  }

  makeRequestsPerSecond() {
    const intervals = Object.create(null);
    const intervalCount = Math.ceil((this.latestTimestamp - this.earliestTimestamp) / 1000);
    const firstInterval = Math.floor(this.earliestTimestamp / 1000);

    for (let i = firstInterval; i <= firstInterval + intervalCount; i++) {
      intervals[i] = 0;
    }

    for (const logObject of this.logObjects) {
      const interval = Math.floor(logObject.ts / 1000);
      intervals[interval] += 1;
    }

    return intervals;
  }
}
