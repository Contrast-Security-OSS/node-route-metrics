# what is this?

This is common code used to parse @contrast/route-metrics' log files.

the idea is to a single place for code that parses route-metrics log files.
and it seems like route-metrics is the right place for that - it's public and
anyone can use it.

## directory layout

- utils/ - top-level directory
- utils/index.mjs - implements RouteMetricsResults class
- utils/types/ - types used by RouteMetricsResults class
- utils/types/_typeBase.mjs - base class for types
- utils/types/meta*.mjs - meta data types, i.e., types that don't appear in route-metrics log files.
- utils/types/type*.mjs - types that appear route-metrics log files.

## things to do

- handle groupings of routes as metaKeyedRoutes
- calculate percentiles for routes, including metaKeyedRoutes
  - cannot do until entire log is processed, so needs to be kicked.
- add tests
- make it a mono-repo and release this as a separate package.
