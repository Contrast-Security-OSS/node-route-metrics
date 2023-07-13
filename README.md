# route-metrics

`route-metrics` allows server performance, exclusive of network time,
to be compared on a route-by-route basis. It was created to compare server
performance with and without `@contrast/agent` being loaded and active.

`route-metrics` measures the elapsed time of http/https requests from the
the time that the `request` event is emitted to the time the response's
`end` function is called. Elapsed time is measured in microseconds but is
output in milliseconds by default.

`route-metrics` writes a log file in which each line is JSON. the log files
can be interpreted using the included `log-processor`.

## usage

As usual, execute `npm install @contrast/route-metrics` to install it.

But, unlike most packages, `route-metrics` is not required by your program.
The `route-metrics` agent must be run by requiring it on the node command line.

```
$ node -r @contrast/route-metrics my-web-server.js
```

If another package, say `@contrast/agent`, is being required on the command
line, then `route-metrics` must be required first:

```
$ node -r @contrast/route-metrics -r @contrast/agent my-web-server.js
```

This allows server performance, exclusive of network time, to be compared
with and without other packages installed. `route-metrics` writes to a json
log file, `route-metrics.log` by default.

## processing the log file

Once the `route-metrics` agent has been used to generate a log file, it's
useful to do something with the output. The included log-processor can be
executed via `npm run log-processor` and will look for the default log file
in the current directory, `./route-metrics.log`. To specify a different log
file or location, `npm run log-processor dir/other-file-name.log`.

The log processor will read the log file, output some informational text,
and use the requested reporter to write the output.

Informational output is enclosed in brackets, e.g., `[this is information]`. So
if the reporter is writing to the default, file descriptor 1 (stdout), the lines
enclosed in brackets are not part of the report. They should all preceed the
reporter output in any case.

### csv reporter output

The first line after the informational lines is the header line.

The percentiles are calculated using the smallest value that is greater than
or equal to the specified percentile of values; no interpolation is done.

### json reporter output

This reporter writes no informational output. It writes the data gathered from
the log file as a single JSON object. The code is the only documentation for it
at this time.

## configuration

All route-metrics agent configuration is done via environment variables. The environment variables
are shown with their default values.

- `CSI_RM_LOG_FILE=route-metrics.log`
- `CSI_RM_GARBAGE_COLLECTION=false`
- `CSI_RM_EVENTLOOP=false`
- `CSI_RM_EVENTLOOP_RESOLUTION=20`

Boolean options must be set to `true` to enable. The eventloop resolution is how often it is
sampled internally by node; the setting is in milliseconds.

The `route-metrics` log processor is also configured via environment variables.

- `CSI_RM_REPORTER=csv`   # json is also valid. the json reporter is a formatted dump of the raw data.
- `CSI_RM_OUTPUT=1`       # if numeric writes to that file descriptor, else writes to that file name.
- `CSI_RM_TEMPLATE`       # a template that defines how the output is grouped
- `CSI_RM_MICROSECONDS`   # report times in microseconds instead of milliseconds. (json reporter
always reports raw data, i.e., microseconds or, in the case of the eventloop delay, nanoseconds.)

## using a template

A template is a JavaScript file that is used to group routes into buckets. For
example, a route may have optional parameters or query params that would make
them appear, by default, as separate routes.

See example/template.js for a simple template with explanatory comments.

## design philosophy

`route-metrics` should have as low an impact on the server as possible. To this end, after startup,
it does everything asynchronously and as efficiently as possible. If you see anything that can be
made more efficient please submit an issue or, ideally, submit a PR.

While `route-metrics` strives to work correctly, it does not implement code to prevent garbage-in,
garbage-out. For example, providing `route-metrics` with an unwritable path will cause an EACCES
error to be thrown. Because the expected use is in a testing environment, this seems reasonable. If
it turns out to be a bad decision, appropriate fallbacks can be implemented.

`route-metrics` is also written with minimal production dependencies. At this time `shimmer` is the
only one.

## limitations

- handles require'd files only
- does not report on web sockets
- does not handle http2 (http/https only)
- `log-processor` has minimal automated testing; manual testing has revealed no inconsistencies
or errors.
