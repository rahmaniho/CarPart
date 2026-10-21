import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Project Pages روی /CarPart/ سرو می‌شود؛ Docker و توسعه از / استفاده می‌کنند.
  base: process.env.VITE_BASE_PATH?.trim() || '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
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
          // Recharts به‌صورت طبیعی داخل dependency مسیر lazy مدیریت باقی می‌ماند
          // تا مرورگر بازدیدکنندهٔ لندینگ آن را preload نکند.
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/'))
            return 'vendor-react';
          return undefined;
        },
      },
    },
  },
});
