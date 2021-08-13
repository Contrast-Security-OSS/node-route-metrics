# working notes


## TODO STUFF
- flesh out this doc
- start output processing


## from NODE-1645 and NODE-1646

specify the MVP scope, i.e supported cases, framework limitations, and output data format.

### MVP scope

Mechanics

- require only (no native esm support)
- writes data-captured to JSON format file
- http/https

Data captured

- http/https, port, path, query params
- length of time each request takes, hi-res (probably not worth it)?
- no framework information, no body, no cookies, no headers.
  - maybe add options for additional info if use cases require

Follow-on extensions

- additional metrics (gc, memory, cpu, etc)
- http2
- import/esm

Output generation

- driven by (optional) hand-coded JSON or javascript-defined object
  - if not supplied then each route stands alone
- lays out top-level meta information
- title, version, inputs?
- driven by route abstraction
- hierarchical, i.e., routes can be accumulated in multiple buckets allowing flame graphs and other visual presentations


## Output generation details

- each route supplies a method, path (via pattern or regex), and name

```
{
  meta: {
    version: "1.0.0"
  },
  labels: {
    title: "this is my test server"
  },
  routes: [
    {name: "GET /", method: "GET", pattern: "/"},
    {name: "GET /artist/{id}", method: "GET", regex: "/artist/[^/]+"},
    {name: "GET /painting/{id}", method: "GET", regex: "/painting/[^/]+"},
    {name: "POST /artist", method: "POST", pattern: "/artist"},
  ]
}
```

In this example all gets would appear in the  GETs will appear in the “GET /” name while artist and painting GETs will additionally appear in their own groupings. A route definition should act approximately like a filter; if the route matches the filter then it appears in the output grouping. “pattern” is separate from “regex” so it’s simpler to enter hardcoded patterns; should there only be regexes?

Using this (initially) hand-coded formatting provides a framework-independent abstraction layer (in addition to deferring the need to provide any automated generation of this information - either at runtime or as pre/post processing).

The initial output should be a simple CSV file with basic stats. errors are recorded but excluded from the latency percentiles.

“this is my test server”

“start-time” to “stop-time”

“GET /”, #observations, errors, latency (p50, p90, p95, p99)

### most basic requirements

The tool runs both with and without the agent using the following
`node -r @contrast/route-metrics app.js` or
`-r @contrast/route-metrics  -r @contrast/agent app.js`

Only support ENV VARs to specify conf settings

# testing

- openssl req -nodes -new -x509 -keyout server.key -out server.cert
- curl -k -X POST -H 'content-type: application/json' -d '@../node-dev-stuff/flamebearer-framework/small-json/many-keys.json' http://localhost:8888/read
  - POST read, meta, echo
  - GET info

# strategies for parsing the log file

- 4 ways to parse lines:
  - file.split('\n')
  - while (m = /([^\n]*?)\n/g.exec(file)) {...}
  - lastIx = 0; while ((ix = file.indexOf('\n', last + 1)) >= 0) {substr...; lastIx = ix}
  - previous but use buffer


## pass 1

given that the file is alread in memory, using `lastIxString` is the fastest.

```
baseline
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [0.06, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.04, 0.03]
group mean 0.034 stddev 0.009
total: gc count: 6, gc time: 2.534
excluding times outside 0.034 +/- 0.017: 0.06
  group times: [0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.04, 0.03]
  group mean 0.031 stddev 0.003

giantFileAsText lastIxString
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [6.55, 6.20, 6.25, 5.95, 6.24, 6.29, 6.21, 6.12, 6.09, 7.22]
group mean 6.313 stddev 0.336
total: gc count: 6, gc time: 3.829
excluding times outside 6.313 +/- 0.672: 7.22
  group times: [6.55, 6.20, 6.25, 5.95, 6.24, 6.29, 6.21, 6.12, 6.09]
  group mean 6.212 stddev 0.155

giantFileAsText split
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [13.10, 13.24, 14.12, 14.33, 13.63, 13.50, 13.31, 12.72, 12.78, 13.75]
group mean 13.448 stddev 0.502
total: gc count: 61, gc time: 22.589
all group times within 12.44 to 14.45 (13.448 +/- 2 * 0.502)

giantFileAsText regex
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [91.35, 96.48, 93.39, 98.48, 94.81, 91.26, 92.01, 89.86, 90.73, 105.18]
group mean 94.355 stddev 4.441
total: gc count: 375, gc time: 77.137
excluding times outside 94.355 +/- 8.881: 105.18
  group times: [91.35, 96.48, 93.39, 98.48, 94.81, 91.26, 92.01, 89.86, 90.73]
  group mean 93.153 stddev 2.730

giantFileAsBuffer lastIxBuffer
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [116.80, 117.84, 119.26, 113.93, 113.40, 116.95, 115.75, 116.99, 116.61, 119.77]
group mean 116.730 stddev 1.923
total: gc count: 818, gc time: 132.596
all group times within 112.88 to 120.58 (116.730 +/- 2 * 1.923)
```

## pass 2

while lastIxString is the fastest, additional logic to handle partial line reads
when reading a file stream (as opposed to reading the entire file at once). as a
result, the stream approach takes longer and causes more GCs with small files. but
on giant files it generates fewer GCs and gc time. and if the file size happens to
exceed 536,870,888, then the stream succeeds while trying to read the whole file
fails. there's not much need to optimize the small file scenario, so it's going with
streaming.

here's the data (the baseline increased slightly as i needed to add async chained
functions to simple-bench to make it work.)

```
baseline
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [0.10, 0.06, 0.07, 0.06, 0.07, 0.06, 0.07, 0.07, 0.09, 0.12]
group mean 0.078 (0.001 per iteration) stddev 0.019
total: gc count: 10, gc time: 4.749
excluding times outside 0.078 +/- 0.039: [0.12]
  group times: [0.10, 0.06, 0.07, 0.06, 0.07, 0.06, 0.07, 0.07, 0.09]
  group mean 0.073 (0.001 per iteration) stddev 0.012
mem mean 62197k (62665, 61741, 61872, 62002, 62131, 62261, 62391, 62522, 62652, 61736)

tinyFilename stream
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [25.87, 22.41, 25.42, 27.86, 23.83, 22.54, 20.94, 20.58, 24.70, 19.34]
group mean 23.350 (0.234 per iteration) stddev 2.532
total: gc count: 41, gc time: 13.512
all group times within 18.29 to 28.41 (23.350 +/- 2 * 2.532)
mem mean 62107k (62140, 61783, 61879, 61840, 62734, 62228, 62261, 61903, 61724, 62580)

bigFilename stream
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [206.54, 189.84, 188.01, 187.09, 186.05, 219.95, 186.47, 180.46, 182.82, 182.61]
group mean 190.983 (1.910 per iteration) stddev 11.826
total: gc count: 275, gc time: 96.581
excluding times outside 190.983 +/- 23.652: [219.95]
  group times: [206.54, 189.84, 188.01, 187.09, 186.05, 186.47, 180.46, 182.82, 182.61]
  group mean 187.765 (1.878 per iteration) stddev 7.198
mem mean 67187k (64881, 67529, 63443, 65932, 68687, 71320, 67043, 62812, 72282, 67938)

giantFilename stream
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [6773.80, 6844.59, 6860.74, 6817.96, 6842.09, 6824.49, 6863.58, 6853.62, 6967.85, 6937.60]
group mean 6858.631 (68.586 per iteration) stddev 53.579
total: gc count: 6497, gc time: 2554.788
excluding times outside 6858.631 +/- 107.157: [6967.85]
  group times: [6773.80, 6844.59, 6860.74, 6817.96, 6842.09, 6824.49, 6863.58, 6853.62, 6937.60]
  group mean 6846.495 (68.465 per iteration) stddev 41.435
mem mean 70802k (69802, 71770, 73625, 75664, 64346, 66240, 68391, 70602, 72744, 74839)

ginormous stream
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [63942.60, 64228.08, 63467.86, 64401.66, 66363.63, 66949.99, 65016.67, 64500.58, 64491.82, 64075.45]
group mean 64743.834 (647.438 per iteration) stddev 1038.649
total: gc count: 60614, gc time: 24591.902
excluding times outside 64743.834 +/- 2077.298: [66949.99]
  group times: [63942.60, 64228.08, 63467.86, 64401.66, 66363.63, 65016.67, 64500.58, 64491.82, 64075.45]
  group mean 64498.705 (644.987 per iteration) stddev 773.160
mem mean 71318k (75353, 70160, 66102, 68131, 70104, 71249, 73229, 74140, 67830, 76885)

tinyFilename read
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [1.97, 1.94, 2.03, 1.66, 2.46, 1.86, 1.75, 2.89, 1.72, 2.58]
group mean 2.085 (0.021 per iteration) stddev 0.394
total: gc count: 13, gc time: 5.854

excluding times outside 2.085 +/- 0.787: [2.89]
  group times: [1.97, 1.94, 2.03, 1.66, 2.46, 1.86, 1.75, 1.72, 2.58]
  group mean 1.996 (0.020 per iteration) stddev 0.304
mem mean 62725k (62483, 62974, 63460, 62269, 62744, 63173, 63600, 62076, 62505, 61962)

bigFilename read
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [110.87, 112.21, 117.93, 118.42, 121.00, 113.71, 113.43, 111.41, 113.85, 116.11]
group mean 114.892 (1.149 per iteration) stddev 3.172
total: gc count: 553, gc time: 177.941
all group times within 108.55 to 121.24 (114.892 +/- 2 * 3.172)
mem mean 66657k (66518, 66551, 66582, 66612, 66643, 66672, 66702, 66732, 66762, 66792)

giantFilename read
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
group times: [3472.77, 3464.35, 3429.18, 3685.00, 3734.57, 3568.77, 3465.25, 3572.20, 3546.60, 3490.51]
group mean 3542.920 (35.429 per iteration) stddev 95.535
total: gc count: 2426, gc time: 1187.559
excluding times outside 3542.920 +/- 191.069: [3734.57]
  group times: [3472.77, 3464.35, 3429.18, 3685.00, 3568.77, 3465.25, 3572.20, 3546.60, 3490.51]
  group mean 3521.625 (35.216 per iteration) stddev 74.875
mem mean 426728k (530999, 531000, 531000, 531001, 531002, 531003, 531003, 183425, 183426, 183426)

ginormous read
executing 10 groups of 100 iterations (1000ms intergroup pause)
excluding group times outside 2 * stddev
(node:22865) UnhandledPromiseRejectionWarning: Error: Cannot create a string longer than 0x1fffffe8 characters
    at Object.slice (buffer.js:605:37)
    at Buffer.toString (buffer.js:804:14)
    at Object.readFileSync (fs.js:438:41)
    at Array.readProcessFile (/home/bruce/github/bmacnaughton/simple-bench/test-definitions.js:161:19)
    at execute (/home/bruce/github/bmacnaughton/simple-bench/index.js:144:29)
    at processTicksAndRejections (internal/process/task_queues.js:95:5)
    at async test (/home/bruce/github/bmacnaughton/simple-bench/index.js:111:5)
(Use `node --trace-warnings ...` to show where the warning was created)
(node:22865) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 2)
(node:22865) [DEP0018] DeprecationWarning: Unhandled promise rejections are deprecated. In the future, promise rejections that are not handled will terminate the Node.js process with a non-zero exit code.
```

