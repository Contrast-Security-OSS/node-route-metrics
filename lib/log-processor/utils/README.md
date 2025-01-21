this was a direct copy from node-real-world-benchmark/lib/route-metrics-utils/,
but is now the master copy that should be used by node-real-world-benchmark, and
eventually, route-metrics-viewer.

the idea is to a single place for code that parses route-metrics log files.
and it seems like route-metrics is the right place for that - it's public and
anyone can use it.

ideally, it becomes a mono-repo so it's not necessary to install all of
route-metrics, but that is a future.
