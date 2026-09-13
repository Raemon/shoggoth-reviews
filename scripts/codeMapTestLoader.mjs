import { registerHooks } from 'node:module';
import { extname } from 'node:path';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const localTypeScript = context.parentURL?.includes('/src/features/') && specifier.startsWith('.') && !extname(specifier);
    return nextResolve(localTypeScript ? `${specifier}.ts` : specifier, context);
  },
});
