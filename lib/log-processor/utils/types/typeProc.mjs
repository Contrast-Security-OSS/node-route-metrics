// {"ts":1734117475609,"type":"proc","tid":0,"entry":{"cpuUser":72,"cpuSystem":36,"cpuUserAvg":18388.800000000003,"cpuSystemAvg":9194.400000000001,"rss":52240384,"heapTotal":4952064,"heapUsed":4781680,"external":1687088,"arrayBuffers":11348}}
import TypeBase from './_typeBase.mjs';

export default class TypeProc extends TypeBase {
  constructor() {
    super('proc');
    // microseconds
    this.totalUser = 0;
    this.totalSystem = 0;
    // bytes
    this.maxRss = 0;
    this.heapTotalSum = 0;
    this.heapUsedSum = 0;
    this.externalSum = 0;
    this.arrayBuffersSum = 0;
  }

  add(logObject) {
    super.add(logObject);
    this.totalUser += logObject.entry.cpuUser;
    this.totalSystem += logObject.entry.cpuSystem;

    this.maxRss = Math.max(this.maxRss, logObject.entry.rss);
    this.heapTotalSum += logObject.entry.heapTotal;
    this.heapUsedSum += logObject.entry.heapUsed;
    this.externalSum += logObject.entry.external;
    this.arrayBuffersSum += logObject.entry.arrayBuffers;
  }

  // the CPU percent is the total CPU used divided by the total time available.
  get cpuPercents() {
    const microsecs = (this.latestTimestamp - this.earliestTimestamp) * 1000;
    return {
      user: this.totalUser / microsecs * 100,
      system: this.totalSystem / microsecs * 100,
      total: (this.totalUser + this.totalSystem) / microsecs * 100,
    };
  }

  get memoryAverages() {
    return {
      maxRss: this.maxRss, // no, it's not an average.
      heapTotal: this.heapTotalSum / this.count,
      heapUsed: this.heapUsedSum / this.count,
      external: this.externalSum / this.count,
      arrayBuffers: this.arrayBuffersSum / this.count,
    };
  }
}
