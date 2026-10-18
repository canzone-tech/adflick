# Technical stack — observed vs policy

Observed Batch-50 source: Next.js 15 / React 19 / TypeScript dashboard; NestJS 11 REST API; MySQL 8.4 via Prisma 6; npm workspaces (`apps/api`, `apps/web`, `packages/shared`); Node 24 chosen for this foundation; GitHub Actions. Redis 7 and MinIO are declared optional local dependencies; verify actual runtime usage per module.

The recovered HTML Smart TV prototype is a **simulation**. A Flutter/Dart device application is NOT present in the verified Batch 50 source. Do not claim Android TV/Flutter device UAT.

Retain production boundaries: independent Ubuntu app account / PM2 / Apache vhosts, private service ports, source-free compiled artifacts, versioned config, and authorized migrations. Production setup is **not provisioned or approved** here.

MySQL is the transactional source of truth. Redis, event queues and object storage must never become authoritative ledgers.
