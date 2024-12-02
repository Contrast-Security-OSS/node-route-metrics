import Module from 'node:module';
import {MessageChannel} from 'node:worker_threads';

if (Module.register) {
  const { port1: mainPort, port2: loaderPort } = new MessageChannel();
  mainPort.on('message', (message) => {
    // log it?
    //console.log('message', message);
  });
  mainPort.unref();
  const data = { port: loaderPort };
  await Module.register('./hooks.mjs', {
    parentURL: import.meta.url,
    data,
    transferList: [loaderPort],
  });
};
