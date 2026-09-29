import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // A flat release can also be uploaded through GitHub's file uploader.
  build: { assetsDir: '' },
});
