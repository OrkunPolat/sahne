# Çok aşamalı: pnpm workspace'i kopyala, yalnızca realtime'ı ve bağımlılıklarını kur.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/protocol/package.json packages/protocol/
COPY packages/engine/package.json packages/engine/
COPY services/realtime/package.json services/realtime/
RUN pnpm install --frozen-lockfile --filter @sahne/realtime...

FROM base AS run
ENV NODE_ENV=production
COPY --from=deps /app ./
COPY packages/protocol packages/protocol
COPY packages/engine packages/engine
COPY services/realtime services/realtime
COPY tsconfig.base.json ./
WORKDIR /app/services/realtime
EXPOSE 4100
# tsx ile doğrudan TS çalıştırılır (deneme kapsamı; build adımı yok).
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
