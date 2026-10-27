# ADFLICK — Advertising, Playout and Binary 1:1 Member Platform

**Project:** ADFLICK only · **Development branch:** `dev/local-foundation` · **Runtime:** Node 24, MySQL 8.4, Prisma, NestJS and Next.js.

Client **SRS v1.0 functional scope approved 27 October 2026** by the project owner. **This approval is for development scope, not compensation, tax/legal advice, payment/provider activation, financial marketing claims or production deployment.**

## What actually exists

The monorepo has operational authentication (JWT/refresh, MFA, RBAC), MySQL-backed advertising campaigns, media/layout/playlist CMS, fleet devices, server-side playback evidence, scheduling, incidents, audit, screen-owner finance ledger/reconciliation and working CI verification. Some web sections are currently operational previews rather than complete production-connected experiences.

**Critical SRS features still to implement and accept:** member identity and referral network, sponsor versus binary placement genealogy, package/e-PIN issuance/transfer/redemption, atomic enrollment, plan versions and binary 1:1 pairing, member wallet/commission/payout request, role-specific public/member/admin UI, full client acceptance test suite. Commercial calculations stay **disabled** pending explicit signed policy and independent legal/finance review.

## Source layout

```text
apps/
  api/              NestJS REST APIs, authentication and existing playout/finance domains
  web/              Next.js public and operations web application
packages/shared/     Shared TypeScript contracts
prisma/              MySQL schema and immutable migration history
scripts/             Local verification, UAT, release and operational scripts
docs/                SRS traceability, policies, acceptance and consolidated batch history
.github/workflows/   Backend CI, Frontend CI, Release Evidence and migration diagnostics
```

See [repository structure and cleanup rules](docs/REPOSITORY-STRUCTURE.md). Batch-by-batch archived manifests, plans and CSV matrices were consolidated into [one batch history](docs/BATCH-HISTORY.md); original content is recoverable from the source Git commit and blob SHA index.

## Local development and verification

Requires **Node.js 24, npm 10+ and Docker Engine/Desktop**. Work from the repository root.

```bash
npm ci
npm run verify
```

`npm run verify` uses a fresh disposable loopback-only MySQL 8.4 and runs source, Prisma, backend and frontend, security/finance, compiled runtime and browser checks. It never approves production. Use only approved project-owned `npm run local:dev:up` development services for persistent local work; do not reset shared databases or delete Docker volumes.

GitHub-first delivery: apply changes to `dev/local-foundation`, get **Backend CI + Frontend CI + Release Evidence PASS on the same exact commit**, then request operator local `git pull` and `npm run verify`. User's local log is a separate gate and is not assumed PASS.

## Decisions, acceptance and release

- [Client SRS v1.0 mapping, gaps and AT-01–AT-20](docs/SRS-V1-TRACEABILITY.md)
- [SRS development backlog](docs/SRS-V1-DELIVERY-BACKLOG.md)
- [Business-rule approval register](docs/BUSINESS-RULES-REGISTER.md)
- [Consolidated historical batch summary and recovery index](docs/BATCH-HISTORY.md)
- [Development/delivery rules](docs/DEVELOPMENT-DELIVERY-RULES.md)
- [UAT checklist](docs/UAT-CHECKLIST.md)
- [Production runbook](docs/PRODUCTION-RUNBOOK.md) and [release signoff](docs/RELEASE-SIGNOFF.md)

**Production NOT AUTHORIZED.** Real encrypted off-host backup and isolated restore, approved business rules, immutable source-free release artifact, operator approval, scoped rollback and external UAT must all be independently verified. No live monetary operations or promised income are enabled.
