import TypeBase from './_typeBase.mjs';

//
// class to hold the route metrics logObjects for a single route.
//
export default class ParseError extends TypeBase {
  static makeKey(method, url) {
    return `${method} ${url}`;
  }

  constructor() {
    super('log-error');
  }

  add(error, logLine, previousLogObject = null) {
    // we make a pseudo-logObject to capture the error
    const logObject = {
      ts: previousLogObject?.ts,
      type: this.key,
      tid: 0,
      entry: {
        error,
        logLine,
        previousLogObject,
      }
    };
    super.add(logObject);
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
}
