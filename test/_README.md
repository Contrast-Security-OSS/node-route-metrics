# Test support files

`test/` contains support files used for testing.

## Components of test/

### certs/

`certs/` contains certs used by the servers. The certs are not signed so the `NODE_TLS_REJECT_UNAUTHORIZED` must be set to `'0'` (the tests do this).

### data/

`data/` contains data that is used by the express server `create` endpoint.

### patcher/

`patcher/` contains code used by the patcher module unit tests.

### servers/

`servers/` implements the servers and server-spawning used by the integration tests.
- `server.js` spawns the specified server and implements functions for interacting with it.
- `skeleton.js` implements common code for different servers (express, simple).
- `simple.js` implements a server using no framework, i.e., just node http/https.
- `express.js` implements a server using the express framework.
