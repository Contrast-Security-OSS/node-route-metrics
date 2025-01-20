// {"ts":1734117475790,"type":"status","tid":0,"entry":{"status":"initializing"}}
import TypeBase from './_typeBase.mjs';

export default class TypeStatus extends TypeBase{
  constructor() {
    super('status');
  }

  add(logObject) {
    if (logObject.type !== this.type) {
      throw new Error(`expected type ${this.type}, got ${logObject.type}`);
    }
    super.add(logObject);
  }
}
