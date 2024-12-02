
### Using [ECMAScript Modules (ESM)](https://nodejs.org/docs/latest-v20.x/api/esm.html)

> NOTES: ECMAScript modules are the JavaScript standard for packaging code for reuse.
They have gone through many changes in Node.js and are still evolving; Contrast fully
supports ESM in node v16.17.0+.

ES modules are loaded with the `import module from 'module'` syntax or using the
`import()` function. Contrast supports both methods.

The following methods should be used to start *all* applications unless it is
certain that *no* ES modules will be loaded by the application or any of its
dependencies. Because it's hard to verify what all dependencies do, using the
following methods are the safest approach.

The following options are available for all methods of specifying the agent.

```
Options:

    -h, --help               output usage information
    -V, --version            output the version number
    -c, --configFile <path>  specify the path to the agent config file
```

#### Legacy Node version < 16.17.0

```bash
# use the legacy method for starting the application
node -r @contrast/agent app-main.js [app arguments]
```

#### ESM Support for Node version >= 16.17.0 and < 18.19.0

```bash
# use --loader  to start the application
node --loader @contrast/agent app-main.mjs [app arguments]
```

#### ESM Support for Node version >= 18.19.0 and < 20.0.0 || >= 20.6.0

```bash
# use --import to start the application
node --import @contrast/agent app-main.mjs [app arguments]
```

> [!NOTE]
> Contrast does not support Node versions >= 20.0.0 and < 20.6.0.



When instrumenting an application that utilizes ECMAScript Modules, use the
following method to start the application. This is the appropriate method for
instrumenting an application that uses CJS, ESM, or a combination of both.

```
    Usage: node --experimental-loader @contrast/protect/lib/esm-loader.mjs app-main.mjs -- [app arguments]

    Options:

        -h, --help               output usage information
        -V, --version            output the version number
        -c, --configFile <path>  path to agent config file
```


## Example log using CSI_HOOKS_LOG=9

The following illustrates:

- the first hooked module is the application's entry point (not yet tested via package.json specification)
- the application is then loaded
- the next hooked module is the first module imported by the application (node:child_process)
- (skip to LOAD of child_process with csi-flag=c)
- the resolve hook changed the path by adding the csi-flag=c
- the loader sees the flag, reads the redirect file, and returns that as the content of the module
  - see [load function](../agent/lib/esm-hooks.mjs#L223)

```
bruce:~/.../csi/node-mono$ CSI_HOOKS_LOG=9 node --import @contrast/agent/lib/esm
-loader.mjs test-integration-servers/express.mjs
ESM HOOK -> INIT
ESM HOOK(2) -> RESOLVE -> file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs from undefined
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> node:child_process from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> node:fs from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> node:module from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./util/json-traverse.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./skeleton.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> @contrast/distringuish from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./util/stash.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> express from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> body-parser from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> multer from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> cookie-parser from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./routes/child_process.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./routes/mongo.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./routes/ssjs.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./routes/xss.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./routes/fs.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./routes/cookies.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./routes/ufu.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./routes/meta.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./routes/raw.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> RESOLVE -> ./routes/text.js from file:///home/bruce/github/csi/node-mono/test-integration-servers/express.mjs
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/esm-hooks/lib/redirects/builtin/child_process.mjs?csi-flag=c
ESM HOOK(2) -> LOAD -> CSI FLAG /home/bruce/github/csi/node-mono/esm-hooks/lib/redirects/builtin/child_process.mjs
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/esm-hooks/lib/redirects/builtin/fs.mjs?csi-flag=c
ESM HOOK(2) -> LOAD -> CSI FLAG /home/bruce/github/csi/node-mono/esm-hooks/lib/redirects/builtin/fs.mjs
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/util/json-traverse.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/skeleton.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/node_modules/@contrast/distringuish/index.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/util/stash.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/esm-hooks/lib/redirects/cjs/express.mjs?csi-flag=c
ESM HOOK(2) -> LOAD -> CSI FLAG /home/bruce/github/csi/node-mono/esm-hooks/lib/redirects/cjs/express.mjs
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/esm-hooks/lib/redirects/cjs/body-parser.mjs?csi-flag=c
ESM HOOK(2) -> LOAD -> CSI FLAG /home/bruce/github/csi/node-mono/esm-hooks/lib/redirects/cjs/body-parser.mjs
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/esm-hooks/lib/redirects/cjs/multer.mjs?csi-flag=c
ESM HOOK(2) -> LOAD -> CSI FLAG /home/bruce/github/csi/node-mono/esm-hooks/lib/redirects/cjs/multer.mjs
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/esm-hooks/lib/redirects/cjs/cookie-parser.mjs?csi-flag=c
ESM HOOK(2) -> LOAD -> CSI FLAG /home/bruce/github/csi/node-mono/esm-hooks/lib/redirects/cjs/cookie-parser.mjs
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/routes/child_process.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/routes/mongo.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/routes/ssjs.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/routes/xss.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/routes/fs.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/routes/cookies.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/routes/ufu.js
CJS(0) -> _load() node:child_process
CJS(0) -> _load() node:fs
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/util/json-traverse.js
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/skeleton.js
CJS(0) -> _load() http
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/util/stash.js
CJS(0) -> _load() @contrast/stash
CJS(0) -> _load() node-gyp-build
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/@contrast/stash/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/@contrast/stash/prebuilds/linux-x64/node.abi115.glibc.node
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/routes/child_process.js
CJS(0) -> _load() util
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/routes/mongo.js
CJS(0) -> _load() ../data/marsdb
CJS(0) -> _load() marsdb
CJS(0) -> _load() ./dist/AsyncEventEmitter
CJS(0) -> _load() eventemitter3
CJS(0) -> _load() ./dist/Collection
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() ./array/map
CJS(0) -> _load() ../function/bindInternal3
CJS(0) -> _load() ./object/map
CJS(0) -> _load() ../function/bindInternal3
CJS(0) -> _load() fast.js/forEach
CJS(0) -> _load() ./array/forEach
CJS(0) -> _load() ../function/bindInternal3
CJS(0) -> _load() ./object/forEach
CJS(0) -> _load() ../function/bindInternal3
CJS(0) -> _load() check-types
CJS(0) -> _load() ./AsyncEventEmitter
CJS(0) -> _load() ./IndexManager
CJS(0) -> _load() fast.js/function/bind
CJS(0) -> _load() ./applyWithContext
CJS(0) -> _load() ./applyNoContext
CJS(0) -> _load() fast.js/object/keys
CJS(0) -> _load() fast.js/forEach
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() invariant
CJS(0) -> _load() ./PromiseQueue
CJS(0) -> _load() fast.js/function/try
CJS(0) -> _load() double-ended-queue
CJS(0) -> _load() ./CollectionIndex
CJS(0) -> _load() invariant
CJS(0) -> _load() ./DocumentRetriver
CJS(0) -> _load() check-types
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() fast.js/array/filter
CJS(0) -> _load() ../function/bindInternal3
CJS(0) -> _load() ./Document
CJS(0) -> _load() check-types
CJS(0) -> _load() fast.js/forEach
CJS(0) -> _load() fast.js/object/keys
CJS(0) -> _load() ./EJSON
CJS(0) -> _load() ./Base64
CJS(0) -> _load() fast.js/array/some
CJS(0) -> _load() ../function/bindInternal3
CJS(0) -> _load() check-types
CJS(0) -> _load() fast.js/object/keys
CJS(0) -> _load() fast.js/forEach
CJS(0) -> _load() ./StorageManager
CJS(0) -> _load() fast.js/object/keys
CJS(0) -> _load() eventemitter3
CJS(0) -> _load() ./PromiseQueue
CJS(0) -> _load() ./EJSON
CJS(0) -> _load() ./CollectionDelegate
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() ./DocumentModifier
CJS(0) -> _load() check-types
CJS(0) -> _load() fast.js/object/assign
CJS(0) -> _load() fast.js/forEach
CJS(0) -> _load() fast.js/array/every
CJS(0) -> _load() ../function/bindInternal3
CJS(0) -> _load() ./EJSON
CJS(0) -> _load() ./Random
CJS(0) -> _load() fast.js/function/try
CJS(0) -> _load() invariant
CJS(0) -> _load() ./DocumentMatcher
CJS(0) -> _load() check-types
CJS(0) -> _load() fast.js/forEach
CJS(0) -> _load() fast.js/object/keys
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() fast.js/array/some
CJS(0) -> _load() fast.js/array/every
CJS(0) -> _load() fast.js/array/indexOf
CJS(0) -> _load() geojson-utils
CJS(0) -> _load() ./EJSON
CJS(0) -> _load() ./Document
CJS(0) -> _load() ./DocumentSorter
CJS(0) -> _load() check-types
CJS(0) -> _load() fast.js/forEach
CJS(0) -> _load() fast.js/array/every
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() fast.js/array/indexOf
CJS(0) -> _load() fast.js/object/keys
CJS(0) -> _load() ./DocumentMatcher
CJS(0) -> _load() ./Document
CJS(0) -> _load() ./Document
CJS(0) -> _load() ./CursorObservable
CJS(0) -> _load() fast.js/function/bind
CJS(0) -> _load() check-types
CJS(0) -> _load() fast.js/object/values
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() ./Cursor
CJS(0) -> _load() fast.js/forEach
CJS(0) -> _load() fast.js/object/assign
CJS(0) -> _load() fast.js/object/keys
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() ./AsyncEventEmitter
CJS(0) -> _load() invariant
CJS(0) -> _load() ./DocumentRetriver
CJS(0) -> _load() ./DocumentMatcher
CJS(0) -> _load() ./DocumentSorter
CJS(0) -> _load() ./DocumentProjector
CJS(0) -> _load() check-types
CJS(0) -> _load() fast.js/forEach
CJS(0) -> _load() fast.js/object/keys
CJS(0) -> _load() fast.js/object/assign
CJS(0) -> _load() fast.js/array/every
CJS(0) -> _load() fast.js/array/filter
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() fast.js/array/indexOf
CJS(0) -> _load() ./EJSON
CJS(0) -> _load() ./Document
CJS(0) -> _load() ./EJSON
CJS(0) -> _load() ./cursor-processors/filter
CJS(0) -> _load() invariant
CJS(0) -> _load() fast.js/array/filter
CJS(0) -> _load() ./cursor-processors/sortFunc
CJS(0) -> _load() invariant
CJS(0) -> _load() ./cursor-processors/map
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() invariant
CJS(0) -> _load() ./cursor-processors/aggregate
CJS(0) -> _load() invariant
CJS(0) -> _load() ./cursor-processors/reduce
CJS(0) -> _load() fast.js/array/reduce
CJS(0) -> _load() ../function/bindInternal4
CJS(0) -> _load() invariant
CJS(0) -> _load() ./cursor-processors/join
CJS(0) -> _load() check-types
CJS(0) -> _load() invariant
CJS(0) -> _load() ./joinObj
CJS(0) -> _load() check-types
CJS(0) -> _load() fast.js/forEach
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() fast.js/array/filter
CJS(0) -> _load() fast.js/array/reduce
CJS(0) -> _load() fast.js/object/keys
CJS(0) -> _load() ../Collection
CJS(0) -> _load() invariant
CJS(0) -> _load() ./joinAll
CJS(0) -> _load() check-types
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() fast.js/function/bind
CJS(0) -> _load() invariant
CJS(0) -> _load() ../DocumentModifier
CJS(0) -> _load() ../DocumentMatcher
CJS(0) -> _load() ../Document
CJS(0) -> _load() ./joinEach
CJS(0) -> _load() check-types
CJS(0) -> _load() fast.js/map
CJS(0) -> _load() invariant
CJS(0) -> _load() ./joinAll
CJS(0) -> _load() ./joinAll
CJS(0) -> _load() ./cursor-processors/joinEach
CJS(0) -> _load() ./cursor-processors/joinAll
CJS(0) -> _load() ./cursor-processors/joinObj
CJS(0) -> _load() ./cursor-processors/ifNotEmpty
CJS(0) -> _load() check-types
CJS(0) -> _load() ./EJSON
CJS(0) -> _load() ./PromiseQueue
CJS(0) -> _load() ./debounce
CJS(0) -> _load() ./ShortIdGenerator
CJS(0) -> _load() ./Random
CJS(0) -> _load() ./EJSON
CJS(0) -> _load() ./dist/CursorObservable
CJS(0) -> _load() ./dist/debounce
CJS(0) -> _load() ./dist/StorageManager
CJS(0) -> _load() ./dist/Random
CJS(0) -> _load() ./dist/EJSON
CJS(0) -> _load() ./dist/Base64
CJS(0) -> _load() ./dist/PromiseQueue
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/routes/ssjs.js
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/routes/xss.js
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/routes/fs.js
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/routes/cookies.js
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/routes/ufu.js
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/routes/meta.js
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/routes/raw.js
CJS(0) -> _load() /home/bruce/github/csi/node-mono/test-integration-servers/routes/text.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/routes/meta.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/routes/raw.js
ESM HOOK(2) -> LOAD file:///home/bruce/github/csi/node-mono/test-integration-servers/routes/text.js
CJS(0) -> _load() express
CJS(0) -> _load() ./lib/express
CJS(0) -> _load() body-parser
CJS(0) -> _load() depd
CJS(0) -> _load() path
CJS(0) -> _load() ./lib/types/json
CJS(0) -> _load() bytes
CJS(0) -> _load() content-type
CJS(0) -> _load() http-errors
CJS(0) -> _load() depd
CJS(0) -> _load() setprototypeof
CJS(0) -> _load() statuses
CJS(0) -> _load() ./codes.json
CJS(0) -> _load() inherits
CJS(0) -> _load() util
CJS(0) -> _load() toidentifier
CJS(0) -> _load() debug
CJS(0) -> _load() ./node.js
CJS(0) -> _load() tty
CJS(0) -> _load() util
CJS(0) -> _load() ./debug
CJS(0) -> _load() ms
CJS(0) -> _load() ../read
CJS(0) -> _load() http-errors
CJS(0) -> _load() destroy
CJS(0) -> _load() events
CJS(0) -> _load() fs
CJS(0) -> _load() stream
CJS(0) -> _load() zlib
CJS(0) -> _load() raw-body
CJS(0) -> _load() async_hooks
CJS(0) -> _load() bytes
CJS(0) -> _load() http-errors
CJS(0) -> _load() iconv-lite
CJS(0) -> _load() safer-buffer
CJS(0) -> _load() buffer
CJS(0) -> _load() ./bom-handling
CJS(0) -> _load() ./streams
CJS(0) -> _load() buffer
CJS(0) -> _load() stream
CJS(0) -> _load() ./extend-node
CJS(0) -> _load() buffer
CJS(0) -> _load() unpipe
CJS(0) -> _load() iconv-lite
CJS(0) -> _load() on-finished
CJS(0) -> _load() async_hooks
CJS(0) -> _load() ee-first
CJS(0) -> _load() unpipe
CJS(0) -> _load() zlib
CJS(0) -> _load() type-is
CJS(0) -> _load() media-typer
CJS(0) -> _load() mime-types
CJS(0) -> _load() ./lib/types/raw
CJS(0) -> _load() bytes
CJS(0) -> _load() debug
CJS(0) -> _load() ../read
CJS(0) -> _load() type-is
CJS(0) -> _load() ./lib/types/text
CJS(0) -> _load() bytes
CJS(0) -> _load() content-type
CJS(0) -> _load() debug
CJS(0) -> _load() ../read
CJS(0) -> _load() type-is
CJS(0) -> _load() ./lib/types/urlencoded
CJS(0) -> _load() bytes
CJS(0) -> _load() content-type
CJS(0) -> _load() http-errors
CJS(0) -> _load() debug
CJS(0) -> _load() depd
CJS(0) -> _load() ../read
CJS(0) -> _load() type-is
CJS(0) -> _load() events
CJS(0) -> _load() merge-descriptors
CJS(0) -> _load() ./application
CJS(0) -> _load() finalhandler
CJS(0) -> _load() debug
CJS(0) -> _load() ./node.js
CJS(0) -> _load() tty
CJS(0) -> _load() util
CJS(0) -> _load() ./debug
CJS(0) -> _load() ms
CJS(0) -> _load() encodeurl
CJS(0) -> _load() escape-html
CJS(0) -> _load() on-finished
CJS(0) -> _load() parseurl
CJS(0) -> _load() url
CJS(0) -> _load() statuses
CJS(0) -> _load() unpipe
CJS(0) -> _load() ./router
CJS(0) -> _load() ./route
CJS(0) -> _load() debug
CJS(0) -> _load() ./node.js
CJS(0) -> _load() tty
CJS(0) -> _load() util
CJS(0) -> _load() ./debug
CJS(0) -> _load() ms
CJS(0) -> _load() array-flatten
CJS(0) -> _load() ./layer
CJS(0) -> _load() path-to-regexp
CJS(0) -> _load() debug
CJS(0) -> _load() methods
CJS(0) -> _load() http
CJS(0) -> _load() ./layer
CJS(0) -> _load() methods
CJS(0) -> _load() utils-merge
CJS(0) -> _load() debug
CJS(0) -> _load() depd
CJS(0) -> _load() array-flatten
CJS(0) -> _load() parseurl
CJS(0) -> _load() setprototypeof
CJS(0) -> _load() methods
CJS(0) -> _load() ./middleware/init
CJS(0) -> _load() setprototypeof
CJS(0) -> _load() ./middleware/query
CJS(0) -> _load() utils-merge
CJS(0) -> _load() parseurl
CJS(0) -> _load() qs
CJS(0) -> _load() ./stringify
CJS(0) -> _load() side-channel
CJS(0) -> _load() get-intrinsic
CJS(0) -> _load() has-symbols
CJS(0) -> _load() ./shams
CJS(0) -> _load() has-proto
CJS(0) -> _load() function-bind
CJS(0) -> _load() ./implementation
CJS(0) -> _load() has
CJS(0) -> _load() function-bind
CJS(0) -> _load() call-bind/callBound
CJS(0) -> _load() get-intrinsic
CJS(0) -> _load() ./
CJS(0) -> _load() function-bind
CJS(0) -> _load() get-intrinsic
CJS(0) -> _load() object-inspect
CJS(0) -> _load() ./util.inspect
CJS(0) -> _load() util
CJS(0) -> _load() ./utils
CJS(0) -> _load() ./formats
CJS(0) -> _load() ./formats
CJS(0) -> _load() ./parse
CJS(0) -> _load() ./utils
CJS(0) -> _load() ./formats
CJS(0) -> _load() debug
CJS(0) -> _load() ./view
CJS(0) -> _load() debug
CJS(0) -> _load() path
CJS(0) -> _load() fs
CJS(0) -> _load() http
CJS(0) -> _load() ./utils
CJS(0) -> _load() safe-buffer
CJS(0) -> _load() buffer
CJS(0) -> _load() content-disposition
CJS(0) -> _load() path
CJS(0) -> _load() safe-buffer
CJS(0) -> _load() content-type
CJS(0) -> _load() depd
CJS(0) -> _load() array-flatten
CJS(0) -> _load() send
CJS(0) -> _load() http-errors
CJS(0) -> _load() debug
CJS(0) -> _load() ./node.js
CJS(0) -> _load() tty
CJS(0) -> _load() util
CJS(0) -> _load() ./debug
CJS(0) -> _load() ms
CJS(0) -> _load() depd
CJS(0) -> _load() destroy
CJS(0) -> _load() encodeurl
CJS(0) -> _load() escape-html
CJS(0) -> _load() etag
CJS(0) -> _load() crypto
CJS(0) -> _load() fs
CJS(0) -> _load() fresh
CJS(0) -> _load() fs
CJS(0) -> _load() mime
CJS(0) -> _load() path
CJS(0) -> _load() fs
CJS(0) -> _load() ./types.json
CJS(0) -> _load() ms
CJS(0) -> _load() on-finished
CJS(0) -> _load() range-parser
CJS(0) -> _load() path
CJS(0) -> _load() statuses
CJS(0) -> _load() stream
CJS(0) -> _load() util
CJS(0) -> _load() etag
CJS(0) -> _load() proxy-addr
CJS(0) -> _load() forwarded
CJS(0) -> _load() ipaddr.js
CJS(0) -> _load() qs
CJS(0) -> _load() querystring
CJS(0) -> _load() ./utils
CJS(0) -> _load() ./utils
CJS(0) -> _load() depd
CJS(0) -> _load() array-flatten
CJS(0) -> _load() utils-merge
CJS(0) -> _load() path
CJS(0) -> _load() setprototypeof
CJS(0) -> _load() ./router/route
CJS(0) -> _load() ./router
CJS(0) -> _load() ./request
CJS(0) -> _load() accepts
CJS(0) -> _load() negotiator
CJS(0) -> _load() ./lib/charset
CJS(0) -> _load() ./lib/encoding
CJS(0) -> _load() ./lib/language
CJS(0) -> _load() ./lib/mediaType
CJS(0) -> _load() mime-types
CJS(0) -> _load() depd
CJS(0) -> _load() net
CJS(0) -> _load() type-is
CJS(0) -> _load() http
CJS(0) -> _load() fresh
CJS(0) -> _load() range-parser
CJS(0) -> _load() parseurl
CJS(0) -> _load() proxy-addr
CJS(0) -> _load() ./response
CJS(0) -> _load() safe-buffer
CJS(0) -> _load() content-disposition
CJS(0) -> _load() http-errors
CJS(0) -> _load() depd
CJS(0) -> _load() encodeurl
CJS(0) -> _load() escape-html
CJS(0) -> _load() http
CJS(0) -> _load() ./utils
CJS(0) -> _load() on-finished
CJS(0) -> _load() path
CJS(0) -> _load() statuses
CJS(0) -> _load() utils-merge
CJS(0) -> _load() cookie-signature
CJS(0) -> _load() crypto
CJS(0) -> _load() ./utils
CJS(0) -> _load() ./utils
CJS(0) -> _load() ./utils
CJS(0) -> _load() cookie
CJS(0) -> _load() send
CJS(0) -> _load() vary
CJS(0) -> _load() ./middleware/query
CJS(0) -> _load() serve-static
CJS(0) -> _load() encodeurl
CJS(0) -> _load() escape-html
CJS(0) -> _load() parseurl
CJS(0) -> _load() path
CJS(0) -> _load() send
CJS(0) -> _load() url
CJS(0) -> _load() body-parser
CJS(0) -> _load() multer
CJS(0) -> _load() ./lib/make-middleware
CJS(0) -> _load() type-is
CJS(0) -> _load() busboy
CJS(0) -> _load() ./utils.js
CJS(0) -> _load() ./types/multipart
CJS(0) -> _load() stream
CJS(0) -> _load() streamsearch
CJS(0) -> _load() ../utils.js
CJS(0) -> _load() ./types/urlencoded
CJS(0) -> _load() stream
CJS(0) -> _load() ../utils.js
CJS(0) -> _load() xtend
CJS(0) -> _load() append-field
CJS(0) -> _load() ./lib/parse-path
CJS(0) -> _load() ./lib/set-value
CJS(0) -> _load() ./counter
CJS(0) -> _load() events
CJS(0) -> _load() ./multer-error
CJS(0) -> _load() util
CJS(0) -> _load() ./file-appender
CJS(0) -> _load() object-assign
CJS(0) -> _load() ./remove-uploaded-files
CJS(0) -> _load() ./storage/disk
CJS(0) -> _load() fs
CJS(0) -> _load() os
CJS(0) -> _load() path
CJS(0) -> _load() crypto
CJS(0) -> _load() mkdirp
CJS(0) -> _load() path
CJS(0) -> _load() fs
CJS(0) -> _load() ./storage/memory
CJS(0) -> _load() concat-stream
CJS(0) -> _load() readable-stream
CJS(0) -> _load() stream
CJS(0) -> _load() ./lib/_stream_readable.js
CJS(0) -> _load() process-nextick-args
CJS(0) -> _load() isarray
CJS(0) -> _load() events
CJS(0) -> _load() ./internal/streams/stream
CJS(0) -> _load() stream
CJS(0) -> _load() safe-buffer
CJS(0) -> _load() buffer
CJS(0) -> _load() core-util-is
CJS(0) -> _load() buffer
CJS(0) -> _load() inherits
CJS(0) -> _load() util
CJS(0) -> _load() ./internal/streams/BufferList
CJS(0) -> _load() safe-buffer
CJS(0) -> _load() util
CJS(0) -> _load() ./internal/streams/destroy
CJS(0) -> _load() process-nextick-args
CJS(0) -> _load() ./lib/_stream_writable.js
CJS(0) -> _load() process-nextick-args
CJS(0) -> _load() core-util-is
CJS(0) -> _load() inherits
CJS(0) -> _load() util-deprecate
CJS(0) -> _load() util
CJS(0) -> _load() ./internal/streams/stream
CJS(0) -> _load() safe-buffer
CJS(0) -> _load() ./internal/streams/destroy
CJS(0) -> _load() ./lib/_stream_duplex.js
CJS(0) -> _load() process-nextick-args
CJS(0) -> _load() core-util-is
CJS(0) -> _load() inherits
CJS(0) -> _load() ./_stream_readable
CJS(0) -> _load() ./_stream_writable
CJS(0) -> _load() ./lib/_stream_transform.js
CJS(0) -> _load() ./_stream_duplex
CJS(0) -> _load() core-util-is
CJS(0) -> _load() inherits
CJS(0) -> _load() ./lib/_stream_passthrough.js
CJS(0) -> _load() ./_stream_transform
CJS(0) -> _load() core-util-is
CJS(0) -> _load() inherits
CJS(0) -> _load() inherits
CJS(0) -> _load() buffer-from
CJS(0) -> _load() ./lib/multer-error
CJS(0) -> _load() cookie-parser
CJS(0) -> _load() cookie
CJS(0) -> _load() cookie-signature
CJS(0) -> _load() querystring
CJS(0) -> _load() qs
CJS(0) -> _load() crypto
CJS(0) -> _load() crypto
CJS(0) -> _load() crypto
CJS(0) -> _load() crypto
CJS(0) -> _load() http
10293
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/semver/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/semver/node_modules/lru-cache/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/semver/node_modules/yallist/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/yaml/package.json)
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/semver/package.json
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/pino/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/pino/node_modules/pino-std-serializers/package.json)
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/semver/node_modules/lru-cache/package.json
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/fast-redact/package.json)
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/semver/node_modules/yallist/package.json
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/quick-format-unescaped/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/pino/node_modules/thread-stream/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/safe-stable-stringify/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/@contrast/require-hook/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/node-gyp-build/package.json)
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/yaml/package.json
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/@swc/core/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/reporter/node_modules/sonic-boom/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/reporter/node_modules/axios/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/follow-redirects/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/mime-types/package.json)
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/pino/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/pino/node_modules/pino-std-serializers/package.json
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/crc-32/package.json)
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/fast-redact/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/quick-format-unescaped/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/pino/node_modules/thread-stream/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/safe-stable-stringify/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/@contrast/require-hook/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/node-gyp-build/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/@swc/core/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/reporter/node_modules/sonic-boom/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/reporter/node_modules/axios/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/follow-redirects/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/mime-types/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/crc-32/package.json
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/@contrast/code-events/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/@contrast/agent-lib/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/detect-libc/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/protect/node_modules/ipaddr.js/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/parent-package-json/package.json)
CJS(init 2) -> _load(/home/bruce/github/csi/node-mono/node_modules/on-exit-leak-free/package.json)
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/@contrast/code-events/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/@contrast/agent-lib/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/detect-libc/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/protect/node_modules/ipaddr.js/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/parent-package-json/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/on-exit-leak-free/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/@contrast/stash/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/marsdb/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/check-types/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/fast.js/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/depd/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/body-parser/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/statuses/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/http-errors/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/toidentifier/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/body-parser/node_modules/debug/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/raw-body/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/on-finished/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/finalhandler/node_modules/debug/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/express/node_modules/debug/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/methods/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/has-symbols/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/has-proto/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/get-intrinsic/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/call-bind/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/object-inspect/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/safe-buffer/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/send/node_modules/debug/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/mime/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/ipaddr.js/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/express/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/object-assign/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/concat-stream/node_modules/safe-buffer/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/multer/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/mkdirp/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/cookie-parser/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/merge-descriptors/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/proxy-addr/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/array-flatten/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/express/node_modules/path-to-regexp/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/bytes/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/@contrast/fn-inspect/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/eventemitter3/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/double-ended-queue/package.json
CJS(0) -> _load() /home/bruce/github/csi/node-mono/node_modules/invariant/package.json
```
