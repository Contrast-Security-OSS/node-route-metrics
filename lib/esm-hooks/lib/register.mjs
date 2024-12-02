import {register} from 'node:module';

export default function() {
  register('./hooks.mjs', import.meta.url);
}
