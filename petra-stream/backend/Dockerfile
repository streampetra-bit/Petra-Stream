# ---------- Stage 1: build ----------
FROM node:20-alpine AS build

# minimal build deps (for native modules)
RUN apk add --no-cache python3 make g++ bash

WORKDIR /usr/src/app

# copy package manifests first for caching
COPY package.json package-lock.json* ./

# install all deps (dev + prod) so tsc and build tools exist
RUN npm ci --silent

# copy source and build
COPY . .
# run the TypeScript build (must exist in package.json scripts)
RUN npm run build

# generate prisma client if your project relies on it and generation happens in a script
# (some projects run `prisma generate` in postinstall/build). If your package.json does not generate it,
# you can uncomment a direct generation step:
# RUN npx prisma generate

# ---------- Stage 2: runtime ----------
FROM node:20-alpine AS runtime

WORKDIR /usr/src/app

# Copy package manifests
COPY package.json package-lock.json* ./

# Install only production deps
RUN npm ci --omit=dev --silent

# Copy compiled output
COPY --from=build /usr/src/app/dist ./dist

# Copy Prisma client (if generated during build). If not present, this step is safe (no-op)
COPY --from=build /usr/src/app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client
# Also copy prisma schema if needed at runtime
COPY --from=build /usr/src/app/prisma ./prisma

# copy other runtime assets if needed (e.g. migrations)
# COPY --from=build /usr/src/app/migrations ./migrations

EXPOSE 4000
ENV NODE_ENV=production

# Start app (adjust if your entrypoint differs)
CMD ["node", "dist/main.js"]
