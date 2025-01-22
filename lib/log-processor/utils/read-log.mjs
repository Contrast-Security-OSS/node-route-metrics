import fsp from 'node:fs/promises';

//
// take the brute force approach now, and read the entire file into memory. if
// it ever becomes a problem, we should just request bigger machines as it's
// much more complex to handle all this with streaming data.
//
export default async function getRouteMetrics(filename, options = {}) {
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
