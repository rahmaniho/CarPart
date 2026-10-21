# انتشار لندینگ در GitHub Pages

لندینگ عمومی کارپارت با Workflow فایل `.github/workflows/pages.yml` ساخته و منتشر می‌شود.

## نشانی انتشار

```text
https://rahmaniho.github.io/CarPart/
```

## فعال‌سازی یک‌باره

Workflow با `actions/configure-pages` تلاش می‌کند Pages را خودکار فعال کند. اگر سیاست دسترسی مخزن
اجازه نداد، در GitHub به مسیر **Settings → Pages → Build and deployment** بروید و Source را روی
**GitHub Actions** قرار دهید. پس از هر Push مرتبط به `main`، Workflow «GitHub Pages» اجرا می‌شود.

## حالت معرفی و اتصال API

GitHub Pages فقط فایل استاتیک میزبانی می‌کند و Backend را اجرا نمی‌کند. اگر متغیر زیر تنظیم نشده
باشد، صفحه به‌صورت صادقانه در «حالت معرفی» منتشر می‌شود: تصاویر، توضیحات و لینک دانلود فعال‌اند،
ولی جست‌وجو/ورود/ثبت‌نام عملیاتی نمایش داده نمی‌شوند.

برای فعال کردن قابلیت‌های آنلاین، در **Settings → Secrets and variables → Actions → Variables**
یک Repository Variable بسازید:

```text
VITE_API_BASE_URL=https://api.example.ir/api/v1
```

API باید عمومی، دارای HTTPS معتبر و CORS آن شامل مبدأ زیر باشد:

```text
https://rahmaniho.github.io
```

هیچ Secret یا کلید خصوصی نباید در متغیر Vite قرار گیرد؛ تمام متغیرهای `VITE_*` داخل JavaScript
عمومی مرورگر قابل مشاهده‌اند.

## جزئیات فنی

- Base Path خروجی: `/CarPart/`
- Router basename: مقدار `import.meta.env.BASE_URL`
- `404.html`: کپی `index.html` برای پشتیبانی Refresh مسیرهای SPA
- `.nojekyll`: جلوگیری از پردازش Jekyll
- Artifact: خروجی `apps/web/dist`
- انتشار با OIDC و `actions/deploy-pages`؛ بدون Token یا Credential سفارشی

## آزمون محلی Build مخصوص Pages

```bash
npm ci
npm run build:contract
npm run build -w @carpart/api-client
VITE_BASE_PATH=/CarPart/ VITE_STATIC_LANDING=true npm run build -w @carpart/web
cp apps/web/dist/index.html apps/web/dist/404.html
```

سپس محتوای `apps/web/dist` را زیر مسیر `/CarPart/` سرو کنید. Build عادی Docker همچنان با Base
Path ریشه (`/`) انجام می‌شود و تحت تأثیر پیکربندی Pages نیست.
