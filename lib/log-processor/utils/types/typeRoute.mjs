import TypeBase from './_typeBase.mjs';

export default class TypeRoute extends TypeBase {
  // a meta-route is a route too, but the type is a key that is the method and
  // url.
  constructor(meta = 'route') {
    super(meta);
  }

  add(logObject) {
    super.add(logObject);
  }

  _groupBy(subGrouper) {
    const group = new Map();

    for (const route of this.logObjects) {
      // this duplicates the key creation in makeUrlKey, but it's a tiny bit of
      // code and avoids unpacking the object twice.
      const {method, protocol, host, port, url, et} = route.entry;
      const key = `${method} ${protocol}://${host}:${port}${url}`;

      let m = group.get(key);
      if (!m) {
        m = {
          method,
          protocol,
          host,
          port,
          url,
          subGroups: new Map(),
        };
        group.set(key, m);
      }
      const subGroupKey = subGrouper(route.entry);
      let observations = m.subGroups.get(subGroupKey);
      if (!observations) {
        observations = [];
        m.subGroups.set(subGroupKey, observations);
      }
      observations.push(et);
    }

    return group;
  }

  groupByNone() {
    return this._groupBy((entry) => 'none');
  }

  // this is a compatibility method for the way the old code worked. it will
  // be retired once route-metrics no longer needs it for testing.
  groupByStatusCode() {
    return this._groupBy((entry) => entry.statusCode);
  }

  groupBySuccessFailure() {
    return this._groupBy((entry) => entry.statusCode >= 400 ? 'failure' : 'success');
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
      'none': 'groupByNone',
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
      // subGroups are grouper-dependent. by-status-code groups using the
      // http status code. by-success-failure groups as success/failure.
      // the original implementation of route-metrics used url for the path,
      // map it to the correct name here.
      const {method, url: path, subGroups} = meta;
      // now for each config-defined bucket
      let matched = false;
      for (const rule of rules) {
        if (rule.method === method) {
          if (rule.startsWith) {
            if (path.startsWith(rule.startsWith)) {
              TypeRoute.saveMatch(groups, rule.name, subGroups);
              matched = true;
            }
          } else if (rule.regex) {
            const m = path.match(rule.regex);
            if (m) {
              // store in bucket
              TypeRoute.saveMatch(groups, rule.name, subGroups);
              matched = true;
            }
          } else if (rule.pattern) {
            if (path === rule.pattern) {
              TypeRoute.saveMatch(groups, rule.name, subGroups);
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
        TypeRoute.saveMatch(rawGroups, key, subGroups);
      }
    }

    // order keys so the template-named buckets come before the default-named
    // buckets (which are really just the raw routes).
    for (const key of rawGroups.keys()) {
      groups.set(key, rawGroups.get(key));
    }

    // sort times ascending so percentiles work
    for (const subGroups of groups.values()) {
      for (const times of Object.values(subGroups)) {
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

  static makeUrlString(logObject) {
    const {protocol, host, port, url} = logObject.entry;
    return `${protocol}://${host}:${port}${url}`;
  }

}
