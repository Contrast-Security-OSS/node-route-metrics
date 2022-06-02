'use strict';

const {expect} = require('chai');

const Ema = require('./ema');

describe('exponential moving average', function() {

  for (const alpha of [0.1, 0.2, 0.4, 0.8]) {
    it(`ema with alpha ${alpha} and initial mean`, function() {
      const data = [10, 20, 30, 20];

      let last = data[0];
      const ema = new Ema(alpha, last);
      for (let i = 1; i < data.length; i++) {
        const update = ema.update(data[i]);
        const expected = last * (1.0 - alpha) + alpha * data[i];
        last = update;
        expect(update).equal(expected);
      }
    });

    it(`ema with alpha ${alpha} and no initial mean`, function() {
      const data = [10, 20, 30, 20];

      let last = 0;
      const ema = new Ema(alpha, last);
      for (let i = 0; i < data.length; i++) {
        const update = ema.update(data[i]);
        const expected = last * (1.0 - alpha) + alpha * data[i];
        last = update;
        expect(update).equal(expected);
      }
    });
  }
});
