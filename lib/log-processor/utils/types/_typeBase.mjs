//
// class to hold the route metrics logObjects for a single type.
//
export default class BaseType {
  constructor(type) {
    this.type = type;
    this.logObjects = [];
  }

  add(logObject) {
    this.logObjects.push(logObject);
  }

  get earliestTimestamp() {
    return this.logObjects[0].ts;
  }
  get latestTimestamp() {
    return this.logObjects.at(-1).ts;
  }

  getFirstTimestampGe(ts) {
    for (let i = 0; i < this.logObjects.length; i++) {
      if (this.logObjects[i].ts >= ts) {
        return i;
      }
    }
    return -1;
  }

  getLastTimesampLe(ts) {
    for (let i = this.logObjects.length - 1; i >= 0; i--) {
      if (this.logObjects[i].ts <= ts) {
        return i;
      }
    }
    return -1;
  }

  get count() {
    return this.logObjects.length;
  }

  filter(fn) {
    return this.logObjects.filter(fn);
  }

  *iterate({start = 0, end = this.logObjects.length} = {}) {
    for (let i = start; i < end; i++) {
      yield this.logObjects[i];
    }
  }
}
