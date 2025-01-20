// {"ts":1734117475610,"type":"patch","tid":0,"entry":{"name":"@contrast/agent"}}
import TypeBase from './_typeBase.mjs';

export default class TypeLoad extends TypeBase {
  constructor() {
    super('load');
  }

  add(logObject) {
    if (logObject.type !== this.type) {
      throw new Error(`expected type ${this.type}, got ${logObject.type}`);
    }
    super.add(logObject);
  }
}
