import TypeBase from './_typeBase.mjs';

export default class TypeRoute extends TypeBase {
  constructor() {
    super('route');
  }

  add(logObject) {
    super.add(logObject);
  }

  // this is a compatibility method for the way the old code worked. it will
  // be retired once route-metrics no longer needs it for testing.
  compatGetRoutesByStatusCode() {
    const routesByStatusCode = new Map();

    for (const route of this.logObjects) {
      const {statusCode, method, protocol, host, port, url, et} = route.entry;
      const key = `${method} ${protocol}://${host}:${port}${url}`;

      let m = routesByStatusCode.get(key);
      if (!m) {
        m = {
          method,
          protocol,
          host,
          port,
          url,
          statusCodes: new Map(),
        };
        routesByStatusCode.set(key, m);
      }
      let observations = m.statusCodes.get(statusCode);
      if (!observations) {
        observations = [];
        m.statusCodes.set(statusCode, observations);
      }
      observations.push(et);
    }

    return routesByStatusCode;
  }

  // group routes that match the rules. a route can match more than one rule.
  //routes: [
  //  { name: 'noecho (ALL PARAMS)', method: 'POST', regex: /^\/noecho(\?.+)?/ },
  //];
  groupBy(templateRoutes) {
    // create config-defined buckets
    const buckets = new Map();
    const rawBuckets = {};

    const routes = this.compatGetRoutesByStatusCode();

    // for each collected metric
    for (const [key, meta] of routes.entries()) {
      // at this time we only match on method and path. more can be added.
      const {method, path, statusCodes} = meta;
      // now for each config-defined bucket
      let matched = false;
      for (const bucket of templateRoutes) {
        if (bucket.method === method) {
          if (bucket.startsWith && path.startsWith(bucket.startsWith)) {
            // store in bucket
            TypeRoute.saveMatch(buckets, bucket.name, statusCodes);
            matched = true;
          } else if (bucket.regex) {
            const m = path.match(bucket.regex);
            if (m) {
              // store in bucket
              TypeRoute.saveMatch(buckets, bucket.name, statusCodes);
              matched = true;
            }
          } else if (bucket.pattern && path === bucket.pattern) {
            TypeRoute.saveMatch(buckets, bucket.name, statusCodes);
            matched = true;
          } else {
            // hmm. either at least one match type must be present. and that
            // should have been verified already.
            throw new Error('template bucket must have startsWith, regex, or pattern');
          }
        }
      }
      if (!matched) {
        // it didn't match any of the template-defined route buckets.
        // put it in its own bucket, like default behavior
        TypeRoute.saveMatch(rawBuckets, key, statusCodes);
      }
    }

    // order keys so the template-named buckets come before the default-named
    // buckets (which are really just the raw routes).
    for (const key in rawBuckets) {
      buckets.set(key, rawBuckets[key]);
    }

    // sort times ascending so percentiles can work
    for (const statuses of buckets.values()) {
      for (const times of Object.values(statuses)) {
        times.sort((a, b) => a - b);
      }
    }

    return buckets;
  }

  static saveMatch(buckets, name, timesByStatus) {
    let bucket = buckets[name];
    if (!bucket) {
      bucket = {};
      buckets[name] = bucket;
    }
    for (const [key, times] of timesByStatus.entries()) {
      if (!bucket[key]) {
        bucket[key] = times.slice();
      } else {
        bucket[key] = bucket[key].concat(times);
      }
    }
  }

}
