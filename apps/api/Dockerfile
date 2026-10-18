# Build from repository root: docker build -f apps/api/Dockerfile -t adflick-api:local .
FROM node:22-bookworm-slim AS build
WORKDIR /workspace
COPY package.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY prisma prisma
COPY prisma.config.ts tsconfig.base.json ./
RUN npm install --no-audit --no-fund
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN npx prisma generate && npm run build -w apps/api

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
# Keep generated Prisma engines and workspace resolution consistent with the build stage.
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/package.json ./package.json
COPY --from=build --chown=node:node /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /workspace/packages/shared ./packages/shared
COPY --from=build --chown=node:node /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /workspace/prisma ./prisma
COPY --from=build --chown=node:node /workspace/prisma.config.ts ./prisma.config.ts
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
