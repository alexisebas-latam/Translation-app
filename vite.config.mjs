import {defineConfig} from 'vite';

export default defineConfig({
  base:'/',
  publicDir:'public',
  build:{
    outDir:'dist',
    emptyOutDir:true,
    target:'es2022',
    sourcemap:false,
    reportCompressedSize:true
  }
});
