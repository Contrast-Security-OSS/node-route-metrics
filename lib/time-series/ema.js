'use strict';

//
// https://nestedsoftware.com/2018/04/04/exponential-moving-average-on-streaming-data-4hhl.24876.html
//
// seems like an alpha of 0.1 is in the right neighborhood
//
class WeightedExpMovingAverage {
  constructor(alpha, mean = 0) {
    this.alpha = alpha;
    this.beta = 1 - this.alpha;
    this.mean = mean;

  }

  update(newValue) {
    // previous observation's weight
    const redistributedMean = this.beta * this.mean;
    // new observation's weight
    const meanIncrement = this.alpha * newValue;

    // new mean
    this.mean = redistributedMean + meanIncrement;

    return this.mean;
  }
}

module.exports = WeightedExpMovingAverage;
