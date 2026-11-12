import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';

const apiSource = new URL('../../apps/api/src/', import.meta.url).href;
const scripts = new URL('../', import.meta.url).href;

// Los imports .js del proyecto siguen funcionando con TypeScript nativo, sin compilar Nest.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL;
    if (parent && (parent.startsWith(apiSource) || parent.startsWith(scripts))
      && (specifier.startsWith('./') || specifier.startsWith('../')) && specifier.endsWith('.js')) {
      const source = new URL(specifier.slice(0, -3) + '.ts', parent);
      if ((source.href.startsWith(apiSource) || source.href.startsWith(scripts)) && existsSync(source)) {
        return nextResolve(source.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
