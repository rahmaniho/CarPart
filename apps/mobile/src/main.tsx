import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

// ثبت Service Worker فقط در وب — در WebView اندروید عمداً غیرفعال است
// (کش SW در WebView باعث وضعیت‌های عجیب و بسته شدن اپ می‌شد)
const isNativeShell = (() => {
  try {
    return /Capacitor/i.test(navigator.userAgent) || window.location.protocol === 'capacitor:';
  } catch {
    return false;
  }
})();
if (import.meta.env.PROD && !isNativeShell && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
