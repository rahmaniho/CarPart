# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/contract/package.json packages/contract/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/

RUN npm ci

COPY tsconfig.base.json ./
COPY packages/contract packages/contract
COPY apps/api apps/api
COPY apps/web apps/web
COPY scripts scripts

RUN npm run build && npm run check:contract

# -------------------------- ایمیج اجرایی سرویس API --------------------------
FROM node:20-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/contract/package.json ./packages/contract/package.json
COPY --from=builder /app/packages/contract/dist ./packages/contract/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist

RUN mkdir -p /app/data /app/uploads && chown -R node:node /app/data /app/uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["node", "apps/api/dist/main.js"]

# ----------------------- ایمیج اجرایی برنامه وب (Nginx) -----------------------
FROM nginx:1.27-alpine AS web
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:80/ || exit 1
