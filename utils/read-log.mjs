import fsp from 'node:fs/promises';

//
// small utility to read a log file and return its contents as an array of
// strings or objects.
//
// RouteMetricsResults instances can be populated with an array or a stream.
// This function exists for places where it's more convenient to hand off a
// filename. The main negative is that it reads the entire file into memory.
//
export default async function readLog(filename, options = {}) {
  const {convert = false} = options;

  // read the route-metrics log file
  let logText = await fsp.readFile(filename, {encoding: 'utf8'});
  logText = logText.split('\n').slice(0, -1);

  if (!convert) {
    return logText;
  }

  const logObjects = logText.map(JSON.parse);

  return logObjects;
}
