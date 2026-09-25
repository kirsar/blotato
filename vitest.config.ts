import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Vitest transforms with esbuild by default, and esbuild cannot emit
// `design:paramtypes` — it has no support for emitDecoratorMetadata at all. Nest
// reads that metadata in two places, and both break without it:
//
//   1. DI — a constructor parameter with no explicit @Inject() token resolves to
//      `undefined` (ProviderRegistry's DiscoveryService is the first to blow up).
//   2. ValidationPipe — it infers the DTO to validate against from the handler
//      parameter's type. With no metatype it silently validates *nothing*, so
//      every malformed body sails through and returns 2xx.
//
// The second is why adding explicit @Inject() tokens everywhere is not an
// alternative: it fixes DI and leaves validation quietly disabled, which makes an
// E2E test actively misleading rather than merely incomplete. SWC emits the
// metadata, mirroring tsconfig.json's experimentalDecorators + emitDecoratorMetadata,
// so test/api.e2e.spec.ts exercises the same app main.web.ts boots.
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  resolve: {
    alias: {
      '@domain': resolve(__dirname, 'src/domain'),
      '@platforms': resolve(__dirname, 'src/platforms'),
      '@repository': resolve(__dirname, 'src/repository'),
      '@agent': resolve(__dirname, 'src/agent'),
    },
  },
});
