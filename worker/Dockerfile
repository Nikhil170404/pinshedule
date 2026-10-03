# Build context is the repository root (the worker imports ../shared).
FROM node:22-alpine AS build
WORKDIR /app
COPY shared ./shared
COPY worker/package.json worker/package-lock.json* ./worker/
RUN cd worker && npm ci --no-audit --no-fund
COPY worker ./worker
RUN cd worker && npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/worker
COPY worker/package.json worker/package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/worker/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
