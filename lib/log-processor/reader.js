'use strict';

const fs = require('fs');

/**
 * async generator that yields lines of a file. yields null on EOF.
 * the function returns the number of characters read which can be
 * fetched via `(await iterator.next()).value`.
 */
async function* getLines({file}) {
  const readstream = fs.createReadStream(file, {encoding: 'utf8'});

  let prevChars = '';
  let charCount = 0;

  for await (const newChars of readstream) {
    charCount += newChars.length;
    let ix = newChars.indexOf('\n');
    if (ix < 0) {
      prevChars = prevChars + newChars;
      continue;
    }

    // there is a newline in newChars.
    //
    // it's possible to concatenate prevChars to newChars, set lastIx = 0 and drop
    // into the loop below but that adds the cost of combining prevChars and
    // newChars. duplicating a couple lines is not a big deal.
    //
    let line = prevChars + newChars.substring(0, ix);
    let lastIx = ix + 1;
    yield line;

    while ((ix = newChars.indexOf('\n', lastIx)) >= 0) {
      line = newChars.substring(lastIx, ix);
      lastIx = ix + 1;
      yield line;
    }

    prevChars = newChars.substring(lastIx);
  }

  if (prevChars) {
    yield prevChars;
  }

  // null for EOF
  yield null;

  // return the characters read as the "done" value.
  return charCount;
}


module.exports = getLines;

