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
import TypeUnknownConfigItems from './types/typeUnknownConfigItems.mjs';

import ParseError from './types/metaParseError.mjs';

import KeyedRoute from './types/metaKeyedRoute.mjs';

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
    this.unknownConfigItems = this.typesIndex['unknown-config-items'] = new TypeUnknownConfigItems();

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

      // if it's a route, group like routes by method/url
      if (logObject.type === 'route') {
        const key = KeyedRoute.makeKey(logObject);
        let keyedRoute = this.keyedRoutes[key];
        if (!keyedRoute) {
          // a KeyedRoute is a collection of logObjects for a method/route combination
          keyedRoute = this.keyedRoutes[key] = new KeyedRoute(key);
        }
        keyedRoute.add(logObject);
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
  }

  async indexStream(stream) {
    const generator = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    const gen = generator[Symbol.asyncIterator]();

    return this.indexAsyncGenerator(gen);
  }

  async indexAsyncGenerator(gen) {
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

        if (logObject.type === 'unknown-config-items') {
          continue;
        }

        // if it's a route, group like routes by method/url
        if (logObject.type === 'route') {
          const key = KeyedRoute.makeKey(logObject);
          let keyedRoute = this.keyedRoutes[key];
          if (!keyedRoute) {
            // a KeyedRoute is a collection of logObjects for a method/route combination
            keyedRoute = this.keyedRoutes[key] = new KeyedRoute(key);
          }
          keyedRoute.add(logObject);
        }

        // each type is captured in its own index with type-specific
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

  groupBy(grouper) {
    return this.route.groupBy(grouper);
  }

  *iterateKeyedRoutes() {
    for (const route of Object.values(this.keyedRoutes)) {
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
