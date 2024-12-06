
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

const initRouteMetrics = require('./init-route-metrics.js');

initRouteMetrics({type: 'esm'});
