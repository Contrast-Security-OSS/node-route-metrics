// {"ts":1734117476612,"type":"gc","tid":0,"entry":{"count":18,"totalTime":16.464802145957947}}
import TypeBase from './_typeBase.mjs';

export default class TypeGc extends TypeBase {
  constructor() {
    super('gc');
    this.totalCount = 0;
    this.totalTime = 0;

    this._maxes = {
      totalCount: 0,
      totalTime: 0,
    };
  }

  add(logObject) {
    super.add(logObject);
    this.totalCount += logObject.entry.count;
    this.totalTime += logObject.entry.totalTime;

    this._maxes.totalCount = Math.max(this._maxes.totalCount, logObject.entry.count);
    this._maxes.totalTime = Math.max(this._maxes.totalTime, logObject.entry.totalTime);
  }

  get totals() {
    return {count: this.totalCount, time: this.totalTime};
  }

  get maxes() {
    return this._maxes;
  }
}
