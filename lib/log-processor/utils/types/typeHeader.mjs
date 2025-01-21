
// {"ts":1734117475608,"type":"header","tid":0,"entry":{"version":"2.0.0-beta.7","argv":["/home/bruce/.nvm/versions/node/v20.18.0/bin/node","/home/bruce/github/oss/realWorld-server/api/index.js"],"execArgv":["--import","@contrast/route-metrics","--import","@contrast/agent"],"node_version":"v20.18.0","os":{"arch":"x64","hostname":"wsl","freemem":27525320704,"totalmem":33495719936,"getPriority":0,"loadavg":[0.07,0.1,0.09],"uptime":575843.05,"type":"Linux","platform":"linux","release":"5.15.167.4-microsoft-standard-WSL2","version":"#1 SMP Tue Nov 5 00:21:55 UTC 2024","userInfo":{"uid":1000,"gid":1000,"username":"bruce","homedir":"/home/bruce","shell":"/bin/bash"},"homedir":"/home/bruce","tmpdir":"/tmp","endianness":"LE","cpus":8,"cpuModel":"11th Gen Intel(R) Core(TM) i7-1185G7 @ 3.00GHz","networkInterfaces":{"lo":[{"address":"127.0.0.1","netmask":"255.0.0.0"},{"address":"10.255.255.254","netmask":"255.255.255.255"},{"address":"::1","netmask":"ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"}],"eth0":[{"address":"172.30.209.12","netmask":"255.255.240.0"},{"address":"fe80::215:5dff:fe88:53cf","netmask":"ffff:ffff:ffff:ffff::"}]}},"package_json":{"name":"realworld-node-express-mongodb-javascript","version":"1.0.0","description":"realWorld Project","main":"api/index.js","scripts":{"start":"node server","dev":"nodemon server","test":"echo \"Error: no test specified\" && exit 1"},"keywords":[],"author":"","license":"ISC","dependencies":{"@aws-sdk/credential-providers":"3.654","@contrast/agent":"^5.21.0","@contrast/route-metrics":"file:../route-metrics/contrast-route-metrics-2.0.0-beta.7.tgz","bcrypt":"^5.1.0","braces":"^3.0.3","cookie-parser":"^1.4.6","cors":"^2.8.5","dotenv":"^16.0.3","express":"^4.21.0","express-async-handler":"^1.2.0","fast-xml-parser":"4.4","jsonwebtoken":"^9.0.2","mongodb":"4.17","mongoose":"6.13","mongoose-unique-validator":"^3.1.0","newman":"^6.2.1","slugify":"^1.6.5","tar":"6.2"},"devDependencies":{"nodemon":"^2.0.20"}},"app_dir":"/home/bruce/github/oss/realWorld-server","config":{"LOG_FILE":"route-metrics.log","OUTPUT_CONFIG":"","GARBAGE_COLLECTION":true,"EVENTLOOP":false,"EVENTLOOP_RESOLUTION":20,"LOG_ALL_LOADS":0}}}

import TypeBase from './_typeBase.mjs';

export default class TypeHeader extends TypeBase {
  constructor() {
    super('header');
  }

  add(logObject) {
    super.add(logObject);
    if (this.count !== 1) {
      throw new Error('unexpected header logObject');
    }

    this.routeMetricsVersion = logObject.entry.version;
    this.nodeVersion = logObject.entry.node_version;
    this.os = {};
    this.os.freemem = logObject.entry.os.freemem;
    this.os.totalmem = logObject.entry.os.totalmem;
    this.os.type = logObject.entry.os.type;
    this.os.release = logObject.entry.os.release;
    this.os.cpus = logObject.entry.os.cpus;
    this.os.cpuModel = logObject.entry.os.cpuModel;

    this.app = {};
    this.app.name = logObject.entry.package_json.name;
    this.app.version = logObject.entry.package_json.version;
  }
}
