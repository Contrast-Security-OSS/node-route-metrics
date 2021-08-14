'use strict';

const fs = require('fs');
const path = require('path');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const reader = require('../../lib/log-processor/reader');

chai.use(chaiAsPromised);
const {expect} = chai;

const dataDir = './test/data/writer';

// note that lines here doesn't mean newline terminated strings; it refers
// to both newline-terminated characters and EOF-terminated characters.
const files = [
  {name: `${dataDir}/item-counts.json`, lines: 1, chars: 64, newlineEnd: false},
  {name: `${dataDir}/empty.txt`, lines: 0, chars: 0, newlineEnd: false},
  {name: `${dataDir}/many-keys.json`, lines: 1, chars: 10023, newlineEnd: true},
  {name: `${dataDir}/frozen-reader.test.js`, lines: 101, chars: 3034, newlineEnd: true},
  {name: `${dataDir}/WARNING-README`, lines: 6, chars: 200, newlineEnd: true},
];

describe('reader', function() {

  it('throws when trying to read without permissions', async function() {
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

  it('throws when trying to read a non-existent file', async function() {
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
      let lineCount = 0;
      let charCount = 0;
      for await (const line of lines) {
        if (line === null) {
          // get the character count
          const readerCharCount = (await lines.next()).value;
          if (f.newlineEnd || f.lines === 0) {
            expect(readerCharCount).equal(charCount);
          } else {
            expect(readerCharCount).equal(charCount - 1);
          }
          expect(readerCharCount).equal(f.chars);
          // double check both against the `wc -c` results
          expect(lineCount).equal(f.lines);
          return;
        }
        lineCount += 1;
        // doesn't return the newlines at the end of a line
        charCount += line.length + 1;
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
      const fsContents = fsText.split('\n');

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
