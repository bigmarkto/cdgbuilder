import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Config do Vitest. Espelha os `paths` do tsconfig (`@/* → ./*`) para que
 * testes possam importar `@/engine/...` igual ao app. Testes só rodam em
 * `engine/` por enquanto — é onde vive a lógica pura.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['engine/**/*.test.ts', 'lib/**/*.test.ts'],
    exclude: ['node_modules', '.next', '_extracted']
  }
});
