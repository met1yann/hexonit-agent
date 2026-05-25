import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  target: 'es2022',
  clean: true,
  minify: true,
  dts: false,
  sourcemap: true,
  splitting: false,
  treeshake: true
});
