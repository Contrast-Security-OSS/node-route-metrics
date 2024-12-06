import * as M from 'node:module';

const require = M.createRequire(import.meta.url);
const primordials = require('./primordials.js');

export default primordials;
