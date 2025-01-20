import fsp from 'node:fs/promises';

//
// take the brute force approach now, and read the entire file into memory. if
// it ever becomes a problem, we should just request bigger machines as it's
// much more complex to handle all this with streaming data.
//
export default async function getRouteMetrics(filename, options = {}) {
  const {convert = false, check = false} = options;

  // read the route-metrics log file
  const logText = await fsp.readFile(filename, {encoding: 'utf8'});

  if (!convert) {
    return logText;
  }

  const logObjects = convertLogText(logText);

  check && checkLogObjects(logObjects);

  return logObjects;
}

export function convertLogText(logText) {
  // convert the route metrics log entries to objects.
  const logObjects = logText.split('\n').slice(0, -1).map(JSON.parse);

  return logObjects;
}

export function checkLogObjects(logObjects) {
  if (logObjects.length === 0) {
    return false;
  }

  if (logObjects[0].type !== 'header') {
    return false;
  }

  for (const logObject of logObjects) {
    if (!logObject.ts || !logObject.type || !logObject.entry) {
      return false;
    }
  }

  return true;
}
