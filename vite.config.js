import { defineConfig } from 'vite';

// Relative base path: works for GitHub Pages project sites
// (https://<user>.github.io/<repo>/) as well as any sub-folder deployment.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5180,
    strictPort: false,
  },
});
