# what is this?

This is common code used to parse @contrast/route-metrics' log files.

It is published to npm as `@contrast/route-metrics-utils`.

## directory layout

- index.mjs - implements RouteMetricsResults class
- types/ - types used by RouteMetricsResults class
- types/_typeBase.mjs - base class for types
- types/meta*.mjs - meta data types, i.e., types that don't appear in route-metrics log files.
- types/type*.mjs - types that appear route-metrics log files.

## releasing

At this time, releasing this is 100% manual. Here's how:
- Change directory to to `utils/`
- Run `npm version <major|minor|patch>`
- Run `npm publish --access public --otp=<2FA code>`

## things to do

- handle groupings of routes as metaKeyedRoutes
- calculate percentiles for grouped routes, including metaKeyedRoutes
  - cannot do until entire log is processed and group created, so post-processing
- more tests.
- automate release process.
