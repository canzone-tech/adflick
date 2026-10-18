# Initial architecture

```text
Browser / Next.js portal
        |
        | HTTPS / JSON REST API (/api/v1)
        v
NestJS API service
        |
        +---- Prisma ORM ---- MySQL 8.4 (canonical transactional data)
        |
        +---- Redis 7 -------- future queues, short-lived cache, rate limits
        |
        +---- S3-compatible object storage / CDN (later batch)
        |
        +---- Socket.IO / device control channel (later batch)
```

## Architecture guardrails
1. MySQL 8.4 is the canonical relational database.
2. API is the only trusted writer for business-critical data.
3. Device events must be validated server-side before they count toward delivery, owner eligibility or billing.
4. Monetary values are represented as integer paise, not floating-point rupees.
5. All timestamps are stored as UTC instants; each screen has a timezone for scheduling.
6. Audit records should be append-only at application level and access-controlled.
7. Authentication and tenant authorization must be implemented before exposing business APIs.
8. Store media bytes in object storage, not as large blobs in MySQL.
