'use strict';

const semver = require('semver');
const path = require('path');
const fs = require('fs');
const os = require('os');

const reader = require('./reader');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const {expect} = chai;

const dataDir = './test/data/reader';

// note that lines here doesn't mean newline terminated strings; it refers
// to both newline-terminated characters and EOF-terminated characters.
const files = [
  {name: `${dataDir}/item-counts.json`, lines: 1, chars: 64, newlineEnd: false},
  {name: `${dataDir}/empty.txt`, lines: 0, chars: 0, newlineEnd: false},
  {name: `${dataDir}/many-keys.json`, lines: 1, chars: 10023, newlineEnd: true},
  {name: `${dataDir}/frozen-reader-test.js`, lines: 101, chars: 3032, newlineEnd: true},
  {name: `${dataDir}/WARNING-README`, lines: 6, chars: 200, newlineEnd: true},
];

// make the presumption that the user has git configured autocrlf true. adjust the
// chars for the additional \r per \n.
if (os.EOL === '\r\n') {
  for (const f of files) {
    let adjustment = f.lines;
    if (!f.newlineEnd && f.lines) {
      adjustment -= 1;
    }
    f.chars += adjustment;
  }
}

describe('reader', function() {
  const ifAtleast16 = semver.gte(process.version, '16.0.0') ? it : it.skip;

  ifAtleast16('throws when trying to read without permissions', async function() {
    async function test() {
      const lines = reader({file: '/root'});
      // eslint-disable-next-line no-unused-vars
      for await (const line of lines) {
        // should not ever iterate
        throw new Error('unexpected line');
      }
    }

    expect(test()).eventually.rejectedWith('EACCES');
  });

  ifAtleast16('throws when trying to read a non-existent file', async function() {
    async function test() {
      const lines = reader({file: '/xyzzy'});
      // eslint-disable-next-line no-unused-vars
      for await (const line of lines) {
        throw new Error('unexpected line');
      }
    }

    expect(test()).eventually.rejectedWith('ENOENT');
  });

  files.forEach(f => {
    const name = path.basename(f.name);
    it(`read correct number of lines and characters in ${name}`, async function() {
      const lines = reader({file: f.name});
      let lineCount = 0, charCount = 0;
      for await (const line of lines) {
        if (line === null) {
          // get the character count
          const readerCharCount = (await lines.next()).value;
          if (f.newlineEnd || f.lines === 0) {
            expect(readerCharCount).equal(charCount);
          } else {
            expect(readerCharCount).equal(charCount - os.EOL.length);
          }
          // double check both against the `wc -c` results
          expect(readerCharCount).equal(f.chars);
          expect(lineCount).equal(f.lines);
          return;
        }
        // If there is a line: update counters
        lineCount += 1;
        // doesn't return the newlines at the end of a line
        charCount += line.length + os.EOL.length;
      }
    });
  });

  files.forEach(f => {
    const name = path.basename(f.name);
    it(`reads the same data as fs for ${name}`, async function() {
      const lines = reader({file: f.name});
      const contents = [];
      for await (const line of lines) {
        if (line === null) {
          break;
        }
        contents.push(line);
      }
      const fsText = fs.readFileSync(f.name, 'utf8');
      const fsContents = fsText.split(os.EOL);

      for (let i = 0; i < contents.length; i++) {
        expect(contents[i]).equal(fsContents[i], `line ${i} mistmatch on ${f.name}`);
      }

      if (f.newlineEnd || f.lines === 0) {
        expect(contents.length).equal(fsContents.length - 1);
      } else {
        expect(contents.length).equal(fsContents.length);
      }
    });
  });


});
