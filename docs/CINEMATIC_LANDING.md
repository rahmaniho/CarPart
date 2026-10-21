# Cinematic landing page

## Architecture

The public landing page remains part of the existing React/Vite web application. Authentication, public catalog routes, account routes, seller routes, API client, and React Query configuration are unchanged.

The cinematic treatment deliberately uses CSS transforms, an optimized WebP hero asset, and an inline SVG network diagram instead of adding Three.js or a motion framework. This keeps the initial JavaScript chunk small and provides a readable experience when animation or advanced rendering is unavailable.

## Real integrations

- Both search forms navigate to the existing `/search` route.
- Search results use `GET /api/v1/catalog/search` through `@carpart/api-client`.
- Landing-page categories use `GET /api/v1/catalog/categories` and include loading and error states.
- Login, registration, account orders, and seller entry points use existing routes.
- The network diagram follows the existing parent-order and seller-child-package architecture. It is explicitly labeled as an illustrative visualization, not live order data.
- The order journey uses the implemented aggregate stages: payment, seller confirmation, preparation, shipping, and delivery.

## Motion and fallbacks

- Interface motion uses compositor-friendly opacity and transforms.
- The mechanical hero uses a small pointer parallax only on capable devices.
- `prefers-reduced-motion: reduce` disables ambient motion, packet animation, reveal transitions, and smooth scrolling.
- The network changes from animated SVG to a semantic vertical flow on narrow screens.
- All essential headings, links, search forms, and explanations remain HTML content without animation.
- The hero artwork is decorative and hidden from assistive technology; the product message remains text.

## Performance notes

- No runtime or animation dependency was added.
- Hero artwork is a local 1536×864 WebP of approximately 50 KB and is loaded eagerly as the LCP candidate.
- Existing noncritical photography uses native lazy loading.
- The landing route remains code-split by the existing router.
- The production build reports a landing chunk of approximately 23 KB (6.3 KB gzip) and page CSS of approximately 48 KB (10.2 KB gzip) at the time of implementation.

These are build artifact sizes, not Lighthouse scores. Lighthouse and real-device GPU measurements must be repeated in the final deployment environment.

## Local development

```bash
npm ci
npm run build:contract
npm run build -w @carpart/api-client
npm run dev
```

The web application is available at `http://localhost:5173`; Vite proxies `/api` to the API on port 4000. Required API environment variables are documented in the deployment documentation. Do not use local development secrets in production.

To run only the web interface against a separately hosted API:

```bash
VITE_API_BASE_URL=https://your-api.example/api/v1 npm run dev:web
```

## Validation commands

```bash
npm run typecheck
npm run lint
npm run test -w @carpart/web
npm run build -w @carpart/web
```

For the static GitHub Pages presentation, set `VITE_STATIC_LANDING=true`. The page then labels API-dependent functionality honestly instead of presenting fabricated catalog data.
