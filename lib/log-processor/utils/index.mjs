// import {createHistogram} from 'node:perf_hooks';
// import assert from 'node:assert';
import readline from 'node:readline';

import TypeHeader from './types/typeHeader.mjs';
import TypeProc from './types/typeProc.mjs';
import TypeGc from './types/typeGc.mjs';
import TypeEventloop from './types/typeEventloop.mjs';
import TypePatch from './types/typePatch.mjs';
import TypeLoad from './types/typeLoad.mjs';
import TypeRoute from './types/typeRoute.mjs';
import TypeStatus from './types/typeStatus.mjs';

import ParseError from './types/metaParseError.mjs';

// import KeyedRoute from './types/metaKeyedRoute.mjs';

export default class RouteMetricsResults {
  //
  // invoke with the logObjects from a route-metrics log file.
  //
  constructor(options = {}) {
    // no longer needed as TypeBase inserts in sorted order
    //logObjects.sort((a, b) => a.ts - b.ts);
    this.logObjects = null;
    this.first = null;
    this.last = null;
    // type 'route'
    //this.routesIndex = Object.create(null);
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

    // for groups of routes. if no foldRules are specified, this is the same
    // as each individual route. if foldRules are specified, multiple routes
    // are grouped according to the foldRules.
    this.keyedRoutes = Object.create(null);

    // for parse errors
    this.parseErrors = new ParseError();
  }

  //
  // index an array of preparsed logObjects.
  //
  indexArray(logObjects) {
    // not clear the benefit of keeping all the log objects separately.
    //this.logObjects = logObjects;

    for (const logObject of logObjects) {
      if (!this.first || logObject.ts < this.first.ts) {
        this.first = logObject;
      }
      if (!this.last || logObject.ts > this.last.ts) {
        this.last = logObject;
      }

      // routes get indexed by a key that includes elements of the url and
      // whether the user specifies fold rules. fold rules are used to merge
      // multiple urls into a single name, e.g., /api/users/1, /api/users/2.
      // TODO NODE-3712 fold rules are currently implemented in route-metrics
      // log-processor but should be moved to this preprocessing step.
      //
      // routes are also stored like any other type, but no other types are
      // handled multiple ways like routes.
      if (logObject.type === 'route') {
        let url = logObject.entry.url;
        // there are no fold rules yet, but here's where i think the logic will
        // go when i move them from the csv/json reporters. foldRules will result
        // in KeyedRoute objects being created for each foldRule a route matches.
        //
        for (const foldRule of this.foldRules) {
          if (foldRule.pat.test(logObject.entry.url)) {
            url = foldRule.fold;
            break;
          }
        }

        // //
        // // left as an example of how to use KeyedRoute
        // //
        // const rk = KeyedRoute.makeKey(logObject.entry.method, logObject.entry.url);
        // const keyedRoute = this.keyedRoutes[rk];
        // if (!keyedRoute) {
        //   this.keyedRoutes[rk] = new KeyedRoute(rk, logObject.entry.method, logObject.entry.url);
        // }
        // this.keyedRoutes[rk].add(logObject);
      } else if (logObject.type === 'unknown-config-items') {
        continue;
      }

      // now each type is captured in its own index with type-specific
      // behavior.
      const type = this.typesIndex[logObject.type];
      if (!type) {
        // it's a bug in the code; fix it.
        throw new Error(`no instance for ${logObject.type}`);
      }
      type.add(logObject);
    }

    // // integrity check while debugging
    // for (const key in this.keyedRoutes) {
    //   const k = this.keyedRoutes[key];
    //   const i = this.routesIndex[key];
    //   check(k, i);
    // }
  }

  async indexStream(stream) {
    const generator = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    const gen = generator[Symbol.asyncIterator]();

    // console.log(await gen.next());

    // for await (const line of gen) {
    //   console.log(line);
    // }
    return this.indexAsyncGenerator(gen);
  }

  async indexAsyncGenerator(gen) {
    let ix = -1;
    let lastLogObject = null;

    // verify the first line is a header.
    try {
      const {done, value: line} = await gen.next();
      if (done) {
        throw new Error('empty log file');
      }
      lastLogObject = JSON.parse(line);

      if (!lastLogObject.ts || !lastLogObject.type || !lastLogObject.entry) {
        throw new Error('invalid log entry');
      }
      if (lastLogObject.type !== 'header') {
        throw new Error('first log entry must be a header');
      }
      this.header.add(lastLogObject);
      this.first = this.last = lastLogObject;
    } catch (e) {
      throw new Error(`error parsing header: ${e.message}`);
    }

    for await (const line of gen) {
      ix += 1;
      try {
        const logObject = JSON.parse(line);
        if (!logObject.ts || !logObject.type || !logObject.entry) {
          throw new Error('invalid log entry');
        }

        if (logObject.ts < this.first.ts) {
          this.first = logObject;
        }
        if (logObject.ts > this.last.ts) {
          this.last = logObject;
        }

        // routes get indexed by a key that includes elements of the url and
        // whether the user specifies fold rules. fold rules are used to merge
        // multiple urls into a single name, e.g., /api/users/1, /api/users/2.
        // TODO NODE-3712 fold rules are currently implemented in route-metrics
        // log-processor but should be moved to this preprocessing step.
        //
        // routes are also stored like any other type, but no other types are
        // handled multiple ways like routes.
        if (logObject.type === 'route') {
          let url = logObject.entry.url;
          // there are no fold rules yet, but here's where i think the logic will
          // go when i move them from the csv/json reporters. foldRules will result
          // in KeyedRoute objects being created for each foldRule a route matches.
          //
          for (const foldRule of this.foldRules) {
            if (foldRule.pat.test(logObject.entry.url)) {
              url = foldRule.fold;
              break;
            }
          }

          // //
          // // left as an example of how to use KeyedRoute
          // //
          // const rk = KeyedRoute.makeKey(logObject.entry.method, logObject.entry.url);
          // const keyedRoute = this.keyedRoutes[rk];
          // if (!keyedRoute) {
          //   this.keyedRoutes[rk] = new KeyedRoute(rk, logObject.entry.method, logObject.entry.url);
          // }
          // this.keyedRoutes[rk].add(logObject);
        } else if (logObject.type === 'unknown-config-items') {
          continue;
        }

        // now each type is captured in its own index with type-specific
        // behavior.
        const type = this.typesIndex[logObject.type];
        if (!type) {
          // it's a bug in the code; fix it.
          throw new Error(`no instance for ${logObject.type}`);
        }
        type.add(logObject);
      } catch (e) {
        // here when the line couldn't be parsed as JSON (or some unanticipated
        // error in the try block).
        this.parseErrors.add(e, line);
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
    return this.first.ts;
  }

  get latestTimestamp() {
    return this.last.ts;
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
/*
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
// */

/*
function check(left, right) {
  const things = [
    'key', 'method', 'url', 'logObjects', 'min', 'max', 'totalEt', '_successCount', 'histogram',
    'earliestTimestamp', 'latestTimestamp', 'earliest', 'latest', 'count', 'successCount', 'mean',
  ];
  for (const thing of things) {
    assert.deepStrictEqual(left[thing], right[thing]);
  }
}
// */
