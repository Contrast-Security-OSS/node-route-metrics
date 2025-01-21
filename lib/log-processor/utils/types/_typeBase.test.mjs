import assert from 'node:assert';

import BaseType from './_typeBase.mjs';

const array = [
  {ts: 1, type: 'header', entry: 'entry1'},
  {ts: 2, type: 'route', entry: 'entry2'},
  {ts: 3, type: 'proc', entry: 'entry3'},
  {ts: 4, type: 'gc', entry: 'entry4'},
  {ts: 5, type: 'route', entry: 'entry5'},
];

describe('_typeBase', function() {
  let type;
  beforeEach(function() {
    type = new BaseType('anything');
  });

  it('adds an object in sorted order', function() {
    const logObject = {ts: 3, type: 'route', entry: 'entry6'};
    for (const obj of array) {
      type.add(obj);
    }

    type.add(logObject);
    assert.equal(type.logObjects[2], array[2]);
    assert.equal(type.logObjects[3], logObject);
    assert.equal(type.logObjects[4], array[3]);

    assert.equal(type.latestTimestamp, array.at(-1).ts);
  });

  it('adds an object at the beginning', function() {
    const logObject = {ts: 0, type: 'route', entry: 'entry6'};
    for (const obj of array) {
      type.add(obj);
    }

    type.add(logObject);
    assert.equal(type.logObjects[0], logObject);
    assert.equal(type.logObjects[1], array[0]);

    assert.equal(type.earliestTimestamp, logObject.ts);
    assert.equal(type.latestTimestamp, array.at(-1).ts);
  });

  it('adds an object at the end', function() {
    const logObject = {ts: 6, type: 'route', entry: 'entry6'};
    for (const obj of array) {
      type.add(obj);
    }

    type.add(logObject);
    assert.equal(type.logObjects[4], array[4]);
    assert.equal(type.logObjects[5], logObject);

    assert.equal(type.earliestTimestamp, array[0].ts);
    assert.equal(type.latestTimestamp, logObject.ts);
  });
});
