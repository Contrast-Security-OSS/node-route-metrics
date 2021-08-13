'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const osMethods = [
  'arch',
  //'cpus',
  'hostname',
  'freemem',
  'totalmem',
  'getPriority',
  'loadavg',
  //'networkInterfaces',
  'uptime',
  'type',
  'platform',
  'release',
  'version',
  'userInfo',
  'homedir',
  'tmpdir',
  'endianness',
  //'constants',
  //'EOL'
];

module.exports = makeHeader;

function makeHeader(version, config) {
  const header = Object.create(null);
  const errors = [];

  header.version = version;
  header.argv = process.argv;
  header.node_version = process.version;

  header.os = getOsInfo(errors);
  header.package_json = getPackageJson(header.argv[1]);
  header.config = config;

  return {header, errors};
}

makeHeader.osMethods = osMethods;


function getOsInfo(errors) {
  const _os = Object.create(null);
  for (const f of osMethods) {
    if (typeof os[f] === 'function') {
      _os[f] = os[f]();
    } else {
      errors.push(`not-function: os.${f}()`);
    }
  }
  //
  // make these a bit more succinct.
  //
  const cpus = os.cpus();
  _os.cpus = cpus.length;
  // ? is this line safe
  _os.cpuModel = cpus[0].model;

  const ni = os.networkInterfaces();
  _os.networkInterfaces = Object.create(null);
  for (const iface in ni) {
    // extract minimal information
    _os.networkInterfaces[iface] = ni[iface].map((ni) => {
      return {
        address: ni.address,
        netmask: ni.netmask
      };
    });
  }

  return _os;
}

//
// look for package.json by walking up the directory tree from
// the run directory.
//
function getPackageJson(runPath) {
  runPath = getRunDirectory(runPath);

  let previous = undefined;
  do {
    try {
      const p = require(`${runPath}/package.json`);
      return p;
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
      }
    }
    previous = runPath;
    runPath = path.resolve(runPath, '..');

  } while (runPath !== previous);

  return undefined;
}

//
// the user either specified a file to run or a directory in which
// node found the file to run.
//
function getRunDirectory(runPath) {
  runPath = path.resolve(runPath);
  try {
    fs.statSync(runPath);
  } catch (e) {
    // it's not a directory and it's not a file, probably because the
    // extension wasn't specified. up one level must be a directory.
    try {
      runPath = path.resolve(runPath, '..');
      fs.statSync(runPath);
    } catch (e) {
      throw new Error(`can't stat ${runPath}`);
    }
  }
  return runPath;
}
