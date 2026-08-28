import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./loader-hook.mjs', import.meta.url).href);
