# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Prisma precisa do OpenSSL para gerar/rodar o engine.
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
# URL fictícia só para o prisma generate validar o schema em build time.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate

COPY . .
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

# Reaproveita node_modules do build (inclui ts-node para o seed).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3000

# Aplica migrations, popula o seed e sobe a API.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && node dist/main"]
