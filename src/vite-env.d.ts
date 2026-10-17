/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'vite-plugin-sri' {
  import type { Plugin } from 'vite';
  export default function sri(options?: any): Plugin;
}
