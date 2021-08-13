'use strict';

const fs = require('fs');

async function reader({file, processLine}) {
  const s = fs.createReadStream(file, {encoding: 'utf8'});

  const done = {};
  const p = new Promise((resolve, reject) => {
    done.resolve = resolve;
    done.reject = reject;
  });

  let byteCount = 0;
  s.on('end', function() {
    done.resolve({byteCount});
  });

  s.on('error', function(e) {
    done.reject(e);
  });

  let leftover = '';
  s.on('data', function(chunk) {
    byteCount += chunk.length;
    leftover = getLines(leftover, chunk);
  });

  function getLines(prevChars, newChars) {
    let ix = newChars.indexOf('\n');
    if (ix < 0) {
      return prevChars + newChars;
    }
    // there is a newline in newChars.
    //
    // it's possible to concatenate prevChars to newChars, set lastIx = 0 and drop
    // into the loop below but that adds the cost of combining prevChars and
    // newChars. duplicating a couple lines is not a big deal.
    //
    let line = prevChars + newChars.substring(0, ix);
    let lastIx = ix + 1;
    processLine(line);

    while ((ix = newChars.indexOf('\n', lastIx)) >= 0) {
      line = newChars.substring(lastIx, ix);
      lastIx = ix + 1;
      processLine(line);
    }

    // return any leftover part
    return newChars.substring(lastIx);
  }

  return p;
}

module.exports = {
  reader,
};
