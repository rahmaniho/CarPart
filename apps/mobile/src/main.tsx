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

// نمایش خطاهای جاوااسکریپت به‌جای صفحه سفید/بسته شدن — برای ریشه‌یابی
function showErrorOverlay(message: string): void {
  try {
    const box = document.createElement('div');
    box.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:#0f172a;color:#fecaca;padding:24px;overflow:auto;font-family:Vazirmatn,Tahoma,sans-serif;font-size:13px;line-height:2;direction:rtl;white-space:pre-wrap';
    box.textContent = 'خطای برنامه (لطفاً این متن را برای پشتیبانی بفرستید):\n\n' + message;
    document.body.appendChild(box);
  } catch {
    /* نادیده */
  }
}
window.addEventListener('error', (event) => showErrorOverlay(String(event.error?.stack ?? event.message)));
window.addEventListener('unhandledrejection', (event) => showErrorOverlay(String((event.reason as Error)?.stack ?? event.reason)));

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
