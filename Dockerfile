# HaVeWa — Produktions-Image (Next.js + Prisma)
FROM node:24-bookworm-slim AS base
WORKDIR /app
# openssl wird vom Prisma-Query-Engine benötigt
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# --- Build ---
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# --- Runtime ---
FROM base AS runner
ENV NODE_ENV=production
# node_modules inkl. Prisma-CLI (für migrate deploy beim Start) übernehmen
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/messages ./messages
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts

# Upload-Verzeichnis (per Volume gemountet)
RUN mkdir -p storage/documents

EXPOSE 3000
# Migrationen anwenden, dann Server starten
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
