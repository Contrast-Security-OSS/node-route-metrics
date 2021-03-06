'use strict';

const readline = require('readline');
const fs = require('fs');

/**
 * async generator that yields lines of a file. yields null on EOF. after the
 * null the function returns the number of characters read which can be fetched
 * via `(await iterator.next()).value`.
 */
async function* reader({file}) {
  const readstream = fs.createReadStream(file, {encoding: 'utf8'});
  const rl = readline.createInterface({
    input: readstream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    yield line;
  }

  yield null;

  return readstream.bytesRead;
}


module.exports = reader;

