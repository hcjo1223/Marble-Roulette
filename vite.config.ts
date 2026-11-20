import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  base: './',
  plugins: [wasm()],
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/examples/')) {
            return 'vendor-three-loaders';
          }
          if (id.includes('node_modules/three')) {
            return 'vendor-three';
          }
          if (id.includes('node_modules/@dimforge/rapier3d')) {
            return 'vendor-rapier';
          }
          if (id.includes('node_modules/canvas-confetti')) {
            return 'vendor-confetti';
          }
        },
      },
    },
  },
});
