// not included at this time. why not?
// {"ts":1734117475610,"type":"patch","tid":0,"entry":{"name":"@contrast/agent"}}
import TypeBase from './_typeBase.mjs';

export default class TypeEventloop extends TypeBase {
  constructor() {
    super('eventloop');
    this.maxes = {99: 0};
  }

  add(logObject) {
    super.add(logObject);
    // all we care about is the highest percentile, generically the 99th. they
    // have to be in order, so just grab the last one.
    const last = Object.keys(logObject.entry).at(-1);
    this.maxes[99] = Math.max(this.maxes[99], logObject.entry[last]);
  }
}
