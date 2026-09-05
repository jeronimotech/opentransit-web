# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# postinstall copies the MapLibre worker into public/, so scripts/ must exist before install
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile

FROM base AS build
# NEXT_PUBLIC_* values are inlined at build time: every one the app reads must be a build ARG here
# (Railway and most PaaS pass service variables as build args only when the Dockerfile declares them).
ARG NEXT_PUBLIC_API_URL=http://localhost:8001
ARG NEXT_PUBLIC_MOCK=0
ARG NEXT_PUBLIC_DEFAULT_CITY=
ARG NEXT_PUBLIC_ROOT_LANDING=0
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_ADMIN_ENABLED=1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_MOCK=$NEXT_PUBLIC_MOCK \
    NEXT_PUBLIC_DEFAULT_CITY=$NEXT_PUBLIC_DEFAULT_CITY NEXT_PUBLIC_ROOT_LANDING=$NEXT_PUBLIC_ROOT_LANDING \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_ADMIN_ENABLED=$NEXT_PUBLIC_ADMIN_ENABLED
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
