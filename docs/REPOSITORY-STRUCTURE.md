# ADFLICK repository structure and cleanup policy

This is the canonical **Node 24 / npm workspaces** layout. Avoid converting to a different monorepo tool, splitting services or moving live routes without evidence and regression tests.

```text
apps/
  api/               NestJS REST API, auth, tenant boundary, runtime services
    src/
      auth/           Authentication, RBAC and tenant scoping
      cms/            Asset/layout/playlist API
      devices/        Fleet runtime and commands
      finance/        MySQL-authoritative financial services
      recovered-domain/  Side-effect-free recovered policy modules (not live integrations)
    test/             HTTP and MySQL integration tests
  web/               Next.js App Router public/admin/member views
packages/
  shared/            Shared workspace contracts
prisma/
  schema.prisma      Canonical MySQL schema; migration history is append-only
  migrations/        Immutable historical SQL migrations
scripts/             Root verification, release and operations tooling
docs/                Architecture, policy, UAT, history and recovery decisions
.github/workflows/   Backend CI, Frontend CI, Release Evidence, diagnostics
```

## Cleanup rules

- Legacy batch-wise manifests, Markdown plans and acceptance CSVs were consolidated into `docs/BATCH-HISTORY.md` on 27 October 2026. All 163 original file paths/blob hashes remain indexed there, plus the historical milestone CSV is recoverable from the preceding Git commit. Do not recreate individual batch documents. Keep current tests and release evidence intact.
- Keep `package-lock.json`, all Prisma migrations, `AGENTS.md`, `.env.example`, existing release scripts, source checks and audit docs. Do not combine migration history or rewrite applied SQL.
- Generated `node_modules/`, `.next/`, `dist/`, screenshots and local secrets are already ignored. Never commit production backups or secrets.
- The recovered policy modules in `apps/api/src/recovered-domain/` intentionally isolate **non-runtime** starter logic from active NestJS services. Future promotion into runtime requires versioned policy approval, tenant/RBAC, DB transactions/outbox, E2E and real UI/player UAT.
- Remove files only after checking imports, npm scripts, CI references, tracked paths, source/audit value and reversible Git history; no speculative mass deletion.
- Runtime layout, repository layout and production artifact layout are distinct: do not copy source, migrations, test fixtures or .git onto the application VPS.
