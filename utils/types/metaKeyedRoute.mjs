import {URL} from 'node:url';
import {createHistogram} from 'node:perf_hooks';

//import TypeBase from './_typeBase.mjs';
import TypeRoute from './typeRoute.mjs';

//
// class to hold the route metrics logObjects for a single method/route.
//
export default class MetaKeyedRoute extends TypeRoute {
  static makeKey(logObject) {
    return `${logObject.entry.method} ${TypeRoute.makeUrlString(logObject)}`;
  }

  constructor(key) {
    // the key is the type for these instances
    super(key);

    this.key = key;
    const [method, ...rest] = key.split(' ');
    this.method = method;
    this.url = new URL(rest.join(' '));

    this.min = Infinity;
    this.max = 0;
    this.totalEt = 0;
    this._successCount = null;
    this.histogram = createHistogram();
  }

  add(logObject) {
    // logObject is a route, but the type of this instance is the key, so a bit
    // of sleight-of-hand is needed to get the logObject added.
    const type = logObject.type;
    logObject.type = this.key;
    super.add(logObject);
    logObject.type = type;

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
