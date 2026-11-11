import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tauri prints Rust errors in the same console; do not wipe them.
  clearScreen: false,
  server: {
    // tauri.conf.json points at this exact port. Not 5173, the usual Vite
    // port: another project running next to this one would take it.
    port: 5183,
    strictPort: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
