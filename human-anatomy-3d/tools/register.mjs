// Lets Node resolve the bare 'three' import used by the browser modules to the vendored copy.
import { register } from 'node:module';
register('./three-resolver.mjs', import.meta.url);
