# ---------- Stage 1: build ----------
FROM node:20-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ bash openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# copy package manifests for cached installs
COPY package.json package-lock.json* ./

# install dev + prod so prisma & tsc are available
RUN npm ci --silent

# copy app sources
COPY . .

# generate prisma client (this reads prisma/schema.prisma)
# Ensure DATABASE_URL is set in build-time env in Render if your schema uses it at generation time.
RUN npx prisma generate

# build TypeScript
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:20-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app

# copy package manifests and install prod deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --silent

# copy compiled code
COPY --from=build /usr/src/app/dist ./dist

# copy generated prisma client & prisma runtime artifacts
COPY --from=build /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /usr/src/app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client

# copy prisma schema if needed at runtime
COPY --from=build /usr/src/app/prisma ./prisma

EXPOSE 4000
ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
