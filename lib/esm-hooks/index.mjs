import Module from 'node:module';
import {MessageChannel} from 'node:worker_threads';

export default async function registerHooks(data) {
  if (Module.register) {
    const {port1: mainPort, port2: loaderPort} = new MessageChannel();
    mainPort.on('message', (message) => {
      // log it?
      //console.log('message', message);
    });
    data = Object.assign({port: loaderPort}, data);
    mainPort.unref();
    await Module.register('./hooks.mjs', {
      parentURL: import.meta.url,
      data,
      transferList: [loaderPort],
    });
  }
}
