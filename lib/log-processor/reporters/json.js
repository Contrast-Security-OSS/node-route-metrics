'use strict';

function report(stream, summary, meta, options = {}) {
  summary.meta = meta;
  stream.write(JSON.stringify(summary, null, 2));
  stream.write('\n');
}

module.exports = {
  report
};
