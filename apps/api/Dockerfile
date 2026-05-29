FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/ai-contracts/package.json ./packages/ai-contracts/

RUN npm install --workspace=@nexus/api

COPY packages ./packages
COPY apps/api ./apps/api
COPY database ./database

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
