import fsp from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';

const dir = path.dirname(fileURLToPath(import.meta.url));

export function fix(str) {
  if (os.type() === 'Windows_NT') {
    return str.replace(/\r\n/g, '\n');
  }
  return str;
}

//
// minimal route-metrics log
//
const minimalCsvStdout =
`[[read 1 summary (16 lines, 3801 chars) from ./test/log-files/minimal-route-metrics.log]]
[start 2024-12-23T19:08:39.275Z, end 2024-12-23T19:08:39.846Z]
[total time measurements 3 across 3 routes]
[@contrast/agent loaded]
[time-series lines processed 8]
route, status, n, mean, stddev, percentiles: 0.5, 0.7, 0.8, 0.9, 0.95
GET https://localhost:40419/info,200,1,4.00,0.00,4,4,4,4,4
POST https://localhost:40419/echo,200,1,13.00,0.00,13,13,13,13,13
POST https://localhost:40419/meta,200,1,5.00,0.00,5,5,5,5,5

`;
const minimalCsvFile = await fsp.readFile(`${dir}/expected-minimal.csv`, 'utf8');
const minimalCsvFileStdout =
`[[read 1 summary (16 lines, 3801 chars) from ./test/log-files/minimal-route-metrics.log]]
[start 2024-12-23T19:08:39.275Z, end 2024-12-23T19:08:39.846Z]
[total time measurements 3 across 3 routes]
[@contrast/agent loaded]
[time-series lines processed 8]
`;
const minimalJson = await fsp.readFile(`${dir}/expected-minimal.json`, 'utf8');

//
// node-real-world-benchmark route-metrics log
//
const nrwbCsvStdout =
`[[read 1 summary (2075 lines, 396534 chars) from ./test/log-files/nrwb-route-metrics.log]]
[start 2024-12-15T15:25:07.377Z, end 2024-12-15T15:25:18.640Z]
[total time measurements 2048 across 5 routes]
[time-series lines processed 24 (gc count 49 gc time 53.046229004859924)]
route, status, n, mean, stddev, percentiles: 0.5, 0.7, 0.8, 0.9, 0.95
GET http://127.0.0.1:4000/api/articles,200,1000,3.35,2.05,3,3,4,4,5
GET http://127.0.0.1:4000/api/articles/feed,200,1000,3.92,5.54,3,4,4,5,5
POST http://127.0.0.1:4000/api/articles,200,1,13.00,0.00,13,13,13,13,13
POST http://127.0.0.1:4000/api/users,201,46,89.15,33.55,70,111,118,127,170
POST http://127.0.0.1:4000/api/users/login,200,1,50.00,0.00,50,50,50,50,50

`;
const nrwbCsvFile = await fsp.readFile(`${dir}/expected-nrwb.csv`, 'utf8');
const nrwbCsvFileStdout =
`[[read 1 summary (2075 lines, 396534 chars) from ./test/log-files/nrwb-route-metrics.log]]
[start 2024-12-15T15:25:07.377Z, end 2024-12-15T15:25:18.640Z]
[total time measurements 2048 across 5 routes]
[time-series lines processed 24 (gc count 49 gc time 53.046229004859924)]
`;
const nrwbJson = await fsp.readFile(`${dir}/expected-nrwb.json`, 'utf8');


export default {
  // csv outputs informational lines to stdout, but not to files
  csv: {
    stdout: {
      'minimal-route-metrics.log': fix(minimalCsvStdout),
      'nrwb-route-metrics.log': fix(nrwbCsvStdout),
    },
    file: {
      'minimal-route-metrics.log': fix(minimalCsvFile),
      'nrwb-route-metrics.log': fix(nrwbCsvFile),
    },
    fileStdout: {
      'minimal-route-metrics.log': fix(minimalCsvFileStdout),
      'nrwb-route-metrics.log': fix(nrwbCsvFileStdout),
    }
  },
  // json is the same for both stdout and file
  json: {
    stdout: {
      'minimal-route-metrics.log': fix(minimalJson),
      'nrwb-route-metrics.log': fix(nrwbJson),
    },
    file: {
      'minimal-route-metrics.log': fix(minimalJson),
      'nrwb-route-metrics.log': fix(nrwbJson),
    },
  },
};
