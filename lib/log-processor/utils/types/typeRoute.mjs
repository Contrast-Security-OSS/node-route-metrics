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
  groupByStatusCode() {
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
          statuses: new Map(),
        };
        routesByStatusCode.set(key, m);
      }
      let observations = m.statuses.get(statusCode);
      if (!observations) {
        observations = [];
        m.statuses.set(statusCode, observations);
      }
      observations.push(et);
    }

    return routesByStatusCode;
  }

  groupBySuccessFailure() {
    const routesBySuccessFailure = new Map();

    for (const route of this.logObjects) {
      const {statusCode, method, protocol, host, port, url, et} = route.entry;
      const key = `${method} ${protocol}://${host}:${port}${url}`;

      let m = routesBySuccessFailure.get(key);
      if (!m) {
        m = {
          method,
          protocol,
          host,
          port,
          url,
          statuses: new Map(),
        };
        routesBySuccessFailure.set(key, m);
      }
      const status = statusCode >= 400 ? 'failure' : 'success';
      let observations = m.statuses.get(status);
      if (!observations) {
        observations = [];
        m.statuses.set(status, observations);
      }
      observations.push(et);
    }

    return routesBySuccessFailure;
  }

  // group routes that match the rules. a route can match more than one rule.
  //routes: [
  //  { name: 'noecho (ALL PARAMS)', method: 'POST', regex: /^\/noecho(\?.+)?/ },
  //];
  // a route entry can contain one and only one of: regex, startsWith, pattern
  groupBy(groupingRules) {
    const {grouper = 'by-status-code', rules} = groupingRules;
    for (const rule of rules) {
      if (!rule.name || !rule.method) {
        throw new Error('template bucket must have name and method');
      }
      let selectorCount = 0;
      ['startsWith', 'regex', 'pattern'].forEach((key) => rule[key] && selectorCount++);
      if (selectorCount !== 1) {
        throw new Error('rule must have one and only one of: startsWith, regex, pattern');
      }
    }

    // create config-defined groupings of routes.
    const groups = new Map();
    const rawGroups = new Map();

    const groupers = {
      'by-status-code': 'groupByStatusCode',
      'by-success-failure': 'groupBySuccessFailure',
    };

    if (!groupers[grouper]) {
      throw new Error(`unknown grouper: ${grouper}`);
    }

    // group either by individual status code or by success/failure
    const routes = this[groupers[grouper]]();

    // for each collected route
    for (const [key, meta] of routes.entries()) {
      // at this time we only match on method and path. more can be added.
      // statuses are grouper-dependent. by-status-code groups using the
      // http status code. by-success-failure groups as success/failure.
      // the original implementation of route-metrics used url for the path,
      // map it to the correct name here.
      const {method, url: path, statuses} = meta;
      // now for each config-defined bucket
      let matched = false;
      for (const rule of rules) {
        if (rule.method === method) {
          if (rule.startsWith) {
            if (path.startsWith(rule.startsWith)) {
              TypeRoute.saveMatch(groups, rule.name, statuses);
              matched = true;
            }
          } else if (rule.regex) {
            const m = path.match(rule.regex);
            if (m) {
              // store in bucket
              TypeRoute.saveMatch(groups, rule.name, statuses);
              matched = true;
            }
          } else if (rule.pattern) {
            if (path === rule.pattern) {
              TypeRoute.saveMatch(groups, rule.name, statuses);
              matched = true;
            }
          } else {
            // hmm. either at least one match type must be present.
            throw new Error('template bucket must have startsWith, regex, or pattern');
          }
        }
      }
      if (!matched) {
        // it didn't match any of the template-defined route buckets.
        // put it in its own bucket, like default behavior
        TypeRoute.saveMatch(rawGroups, key, statuses);
      }
    }

    // order keys so the template-named buckets come before the default-named
    // buckets (which are really just the raw routes).
    for (const key of rawGroups.keys()) {
      groups.set(key, rawGroups.get(key));
    }

    // sort times ascending so percentiles work
    for (const statuses of groups.values()) {
      for (const times of Object.values(statuses)) {
        times.sort((a, b) => a - b);
      }
    }

    return groups;
  }

  static saveMatch(groups, name, timesByStatus) {
    let group = groups.get(name);
    if (!group) {
      group = {};
      groups.set(name, group);
    }
    for (const [key, times] of timesByStatus.entries()) {
      if (!group[key]) {
        group[key] = times.slice();
      } else {
        group[key] = group[key].concat(times);
      }
    }
  }

}
