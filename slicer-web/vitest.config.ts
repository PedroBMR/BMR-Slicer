import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  resolve: {
    alias: {
      'three/addons/loaders/BufferGeometryLoader.js': fileURLToPath(
        new URL('./tests/stubs/BufferGeometryLoader.ts', import.meta.url)
      ),
      'three/addons/loaders/STLLoader.js': fileURLToPath(
        new URL('./tests/stubs/STLLoader.ts', import.meta.url)
      ),
      'three/examples/jsm/loaders/BufferGeometryLoader.js': fileURLToPath(
        new URL('./tests/stubs/BufferGeometryLoader.ts', import.meta.url)
      ),
      'three/examples/jsm/loaders/STLLoader.js': fileURLToPath(
        new URL('./tests/stubs/STLLoader.ts', import.meta.url)
      )
    }
  },
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov']
    }
  }
});
