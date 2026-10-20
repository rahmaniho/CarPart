import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    // اجازه به هاست‌های پیش‌نمایش (sandbox) — در استقرار واقعی با reverse proxy محدود شود
    allowedHosts: true,
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          if (id.includes('@capacitor')) return 'vendor-native';
          return undefined;
        },
      },
    },
  },
});
