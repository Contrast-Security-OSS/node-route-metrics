//
// class to hold the route metrics logObjects for a single type.
//
export default class BaseType {
  constructor(type) {
    this.type = type;
    this.logObjects = [];
  }

  add(logObject) {
    // hate to have to check this every time, but it's the only way to make it
    // self-intializing for streaming data.
    if (this.logObjects.length === 0) {
      this.logObjects.push(logObject);
      return;
    }
    // the most common case is that the logObjects are in order.
    if (logObject.ts >= this.latestTimestamp) {
      this.logObjects.push(logObject);
      return;
    }

    // for some reason, this object is not in order. find the right
    // place to insert it.
    for (let i = this.logObjects.length - 1; i >= 0; i--) {
      if (this.logObjects[i].ts <= logObject.ts) {
        this.logObjects.splice(i + 1, 0, logObject);
        return;
      }
    }
    // don't think we should ever get here; just add it to the front.
    this.logObjects.unshift(logObject);
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
