# ADFLICK — Consolidated Batch Engineering History

**One canonical historical summary:** 27 October 2026 · Source commit `8676cb2b54a75ad26ad9d14d8f2cbd92e4dd3450`.

**Client SRS v1.0 functional scope is APPROVED by the project owner in chat on 27 October 2026.** The client's document was originally labelled Draft; functional scope approval is not legal, financial, or production authorization. Exact commission/binary rules, e-PIN sales, fees, payouts, cash flows, promotional amounts and claims remain **UNAPPROVED / DISABLED** until independent business, finance and qualified legal review.

This file replaces **163** root-level and docs batch manifests, Markdown summaries and CSVs, plus one superseded legacy milestone register (**164 total removed files**). No actual application source, test suite, Prisma migration, release evidence or finance ledger was intentionally removed. The per-file source Git object IDs are listed below so the original text can be recovered using `git show 8676cb2:<path>`; full Git history is preserved. The original historical CSV acceptance rows are embedded in this same file, not converted into fake pass claims or placeholder records.

## Current product direction and limits

- Canonical architecture: `apps/web` Next.js and `apps/api` NestJS, `prisma/` MySQL 8.4 and Prisma, `packages/shared`, authenticated REST, CI and root `npm run verify`.
- Existing runtime scope: operations login/RBAC/MFA, screen fleet, campaign/media/layout/playlist CMS, delivery scheduling, playback evidence validation, incidents, screen-owner reward eligibility, finance/payout batch reconciliation and audit.
- **Approved client SRS adds missing business core:** public marketing/member portal; member identity, sponsor attribution, binary LEFT/RIGHT placement, package + e-PIN lifecycle, atomic registration, genealogy, plan versions, pairing run/carry-forward and wallet/commission ledger. These are **not yet complete** despite passing playout CI. See [SRS traceability](SRS-V1-TRACEABILITY.md).
- Recovered B102–150 pure helpers are **source-backed subsets** and not proof of durable API/DB/UI integration. B051–101 originals (and B101) remain missing. Real Smart TV player/remote/offline/physical proof-of-play UAT are still pending.
- Production is **NOT AUTHORIZED**: exact-SHA backend/frontend/release gates, fresh local verification, actual encrypted off-host backup plus isolated restore, rollback, legal/financial approval, and operator/product UAT are independent requirements.

## Milestone summaries

| Engineering batches | Actual engineering scope / retained code evidence | Open acceptance boundary |
| --- | --- | --- |
| 01–05 | Workspace, identity, CMS media/assets/layouts, devices, proof-of-play | Real device/browser security and playback evidence |
| 06–10 | Campaign workflow, delivery scheduling/playlist sync, offline incident workflow | Live UI-to-MySQL and device integration |
| 11–15 | API automation, security checks, CI, operational diagnostics/outbox | Current runtime/CI UAT rather than original source claims |
| 16–20 | Screen-owner reward ledger/approval, provider-neutral reconciliation and sandbox adapter | Real payout/provider and commercial approvals **disabled** |
| 21–31 | Tenant isolation, RBAC/endpoint guards, regression E2E, idempotency/export security | No cross-tenant access; DB-backed negative cases |
| 32–41 | Finance atomicity, reconciliation races, duplicate import protection | Disposable MySQL real concurrency checks |
| 42–50 | Import processing leases, safe retries, read/API E2E, release checks, committed lockfile | Actual exact-SHA CI + separate local gate |
| 051–101 | Legacy source recovery gap | **BLOCKED**: originals absent; do not claim completion |
| 102–118 | Reconciliation, owner/billing/wallet policy helpers, fleet and diagnostics | Canonical wiring and test evidence pending |
| 119–125 | Player updates, release/key trust, device command governance | Physical player/update UAT and cryptographic gates pending |
| 126–135 | Command analytics, incident reviews, fleet reliability and technician maintenance | Pure recovered helpers; API/DB/UI still incomplete |
| 136–150 | Report exports, audit/incident governance, compliance, deployment/SLO release gates | Policy-only subset, not production accepted |

## Preserved verification and financial safety boundary

- MySQL 8.4 remains authoritative; Prisma migrations must be append-only. Historical migrations are **not** cleaned up.
- Tenant predicates and role checks protect every critical write/read; cross-tenant data is inaccessible. **Tenant predicates** must be asserted at API and database boundaries.
- Source-level checks do not prove runtime acceptance: **runtime tests are not implied by static checks**.
- Historical Batch 21: **Live transfers remain disabled** until financial/legal approvals and provider UAT.
- Historical Batch 25: **Live transfers stay disabled** regardless of sample calculations or approval-state UI.
- Historical Batch 47: integration tests run only against a **disposable local MySQL 8.4** test DB; this summary and its scanners do not **create or enable live payouts**.
- Acceptance matrices below represent actual historical engineering test plans and scenario IDs; a listed scenario is not evidence that it passed in the current release.
- SRS v1.0 acceptance AT-01–AT-20 belongs in [SRS traceability](SRS-V1-TRACEABILITY.md) and is not automatically green.

## Historical acceptance matrices — preserved original CSV

Actual matrix contents (role, scenario and coverage rows) are reproduced verbatim in Markdown CSV code fences to preserve static-check coverage and reviewability without individual files.

### docs/BATCH_21_ROLE_PERMISSION_REGRESSION_MATRIX.csv

```csv
Role,Resource,Own tenant,Other tenant,Create,Read,Update,Delete,Export,Approval separation,Audit evidence
Super Admin,Platform resources,Explicit grant,Explicit grant only,Policy-based,Policy-based,Policy-based,Policy-based,Policy-based,Required for finance,Reason and actor audit
Organization Admin,Organization-owned resources,Allow by permission,Deny,Deny unless granted,Allow by permission,Allow by permission,Allow by permission,Allow by permission,Required for finance,Actor and tenant audit
Advertiser,Campaigns and billing,Own account only,Deny,Permission-based,Own records,Own records,Deny or workflow,Own reports only,Not applicable,Campaign and billing audit
Screen Owner,Devices and rewards,Own devices only,Deny,Pairing workflow,Own devices/events,Limited profile only,Deny,Own statements only,Not applicable,Pairing and eligibility audit
Content Manager,Assets/playlists,Assigned tenant, Deny,Permission-based,Assigned tenant,Permission-based,Workflow-based,Permission-based,Not applicable,Content change audit
Operations Manager,Devices/incidents,Assigned scope,Deny,Workflow-based,Assigned scope,Workflow-based,Restricted,Restricted,No self-approval,Command and incident audit
Finance Manager,Ledger/payouts,Authorized finance scope,Deny,Workflow-based,Read finance records,Workflow-based,No ledger deletion,Controlled export,Maker-checker required,Ledger and approval audit
Support Agent,Support cases,Assigned cases only,Deny,Case workflow,Assigned cases,Limited workflow,No,No by default,No sensitive approval,Case access audit
Auditor/Compliance,Audit and reports,Approved scope,Deny unless approved,No,Read-only,No,No,Controlled read-only export,No approval authority,Access/export audit
```

### docs/BATCH_22_TENANT_ISOLATION_REGRESSION_CASES.csv

```csv
Case ID,Area,Actor,Attempt,Expected result,Priority
TEN-001,Campaigns,Org A advertiser,Read Org B campaign by ID,Not found and no data disclosed,Critical
TEN-002,Campaigns,Org A manager,Update Org B campaign by ID,No mutation in Org B,Critical
TEN-003,CMS,Org A content manager,Publish Org B layout by ID,No mutation in Org B,Critical
TEN-004,CMS,Org A content manager,Activate playlist containing Org B asset,Rejected,Critical
TEN-005,Devices,Org A operations manager,Assign Org B playlist to Org A screen,Rejected,Critical
TEN-006,Devices,Org A administrator,Change status of Org B screen,Not found and no mutation,Critical
TEN-007,Playback,Org A finance manager,Request report for Org B screen ID,No Org B rows returned,Critical
TEN-008,Incidents,Org A support agent,Update Org B incident by ID,Not found and no mutation,Critical
TEN-009,Finance,Org A finance manager,Approve Org B reward calculation,Not found and no ledger write,Critical
TEN-010,Payouts,Org A finance manager,Reconcile payout item from Org B batch,Rejected and no mutation,Critical
TEN-011,Disputes,Org A finance manager,Resolve Org B dispute by ID,Not found and no mutation,Critical
TEN-012,Authorization,No organization context,Call organization-scoped service,Fail closed,Critical
TEN-013,Authorization,Org A user,Supply organizationId=Org B in body,Ignore or reject caller tenant override,Critical
TEN-014,Finance,Same maker,Approve own payout batch,Forbidden,Critical
TEN-015,Finance,Two authorized finance users,Submit duplicate approval concurrently,Exactly one valid transition,Critical
TEN-016,Playback,Device secret holder,Replay duplicate event batch,Idempotent duplicate handling,High
TEN-017,Webhook,Provider callback,Replay previously accepted event,No duplicate financial transition,Critical
TEN-018,Storage,Org A user,Guess Org B object storage key,Denied by API and storage policy,Critical
TEN-019,Background job,Worker identity,Run scheduled job twice concurrently,No duplicate side effects,High
TEN-020,Audit,Org A user,Attempt cross-tenant export,No export and security event logged,Critical
```

### docs/BATCH_23_TENANT_TEST_CASES.csv

```csv
Case ID,Module,Scenario,Expected assertion,Test layer,Priority
B23-001,Campaigns,Org A edits Org B campaign by direct ID,Not found and campaign.update not called,Service Jest,Critical
B23-002,Campaigns,No organization context reads campaign,Rejected before findFirst,Service Jest,Critical
B23-003,Incidents,Org A updates Org B incident,Not found; update and audit not called,Service Jest,Critical
B23-004,Payouts,Org A resolves Org B dispute,Not found; transaction not opened,Service Jest,Critical
B23-005,Payouts,No organization context lists batches,Rejected before database access,Service Jest,Critical
B23-006,CMS,Org A publishes Org B layout,Not found and no update,Service Jest,Critical
B23-007,Devices,Org A changes Org B screen state,Not found and no mutation,Service Jest,Critical
B23-008,Playback,Org A reports on Org B screen,No Org B events returned,MySQL integration,Critical
B23-009,Finance,Concurrent duplicate reward approval,Exactly one ledger accrual,MySQL integration,Critical
B23-010,Provider,Duplicate signed callback,No duplicate state transition,MySQL integration,Critical
B23-011,Campaigns,Org A replaces associations with Org B asset IDs,Rejected with no association changes,MySQL integration,Critical
B23-012,Storage,Org A requests Org B object key,Denied,HTTP/storage integration,Critical
B23-013,Role matrix,Each role invokes every protected route,Expected allow/deny decision,HTTP integration,Critical
B23-014,MySQL,Fresh migration deploy and constraints,Migration success and expected unique constraints,Database integration,High
B23-015,Audit,Failed cross-tenant write,No target mutation; safe security evidence recorded where designed,Integration,High
```

### docs/BATCH_24_AUTHORIZATION_TEST_MATRIX.csv

```csv
Case ID,Module,Actor,Action,Expected result,Layer,Severity
B24-001,CMS,Org A admin,Publish Org B layout by ID,Not found and no update/audit,Service Jest,Critical
B24-002,Devices,Org A admin,Suspend Org B screen by ID,Not found and no mutation,Service Jest,Critical
B24-003,Devices,Org A admin,Suspend own screen,Update where includes organizationId,Service Jest,Critical
B24-004,Playback,Org A finance manager,Request report for Org B screen ID,Query still includes Org A organizationId,Service Jest,Critical
B24-005,Playback,Finance manager without tenant,Request report,Rejected before database query,Service Jest,Critical
B24-006,CMS,Org A manager,Activate playlist containing Org B asset,Rejected and no state change,MySQL integration,Critical
B24-007,Devices,Org A operations manager,Report result for Org B command,Rejected and no command mutation,HTTP integration,Critical
B24-008,Devices,Unpaired player,Send heartbeat or commands,Rejected,Critical
B24-009,Playback,Valid device,Replay duplicate proof-of-play event,Idempotent handling,MySQL integration,Critical
B24-010,Playback,Org A auditor,Export report using Org B screen ID,No Org B data returned,HTTP integration,Critical
B24-011,Finance,Two checkers,Approve same reward concurrently,Single valid approval/ledger effect,MySQL integration,Critical
B24-012,Storage,Org A user,Request Org B asset object URL,Denied,Storage integration,Critical
B24-013,API,Every role,Call all protected endpoints,Role matrix enforced by server,HTTP integration,Critical
```

### docs/BATCH_25_ROLE_PERMISSION_ACCEPTANCE_MATRIX.csv

```csv
role,read_campaigns,manage_campaigns,manage_content,manage_devices,manage_incidents,manage_rewards,manage_payouts,approve_payouts,audit_reports,notes
SUPER_ADMIN,yes,yes,yes,yes,yes,yes,yes,yes,yes,Platform-wide access must still respect explicit organization scope for tenant-owned data
ORGANIZATION_ADMIN,yes,yes,yes,yes,yes,yes,yes,yes,yes,Organization-scoped administration only
ADVERTISER,yes,yes,limited,none,none,none,none,none,none,Must not access finance or other advertisers' records
SCREEN_OWNER,none,none,none,limited,limited,read-own-only,none,none,none,Owner-facing self-service routes require owner identity and resource ownership checks
CONTENT_MANAGER,yes,limited,yes,limited,none,none,none,none,limited,Content/device operations only as explicitly granted
OPERATIONS_MANAGER,yes,yes,yes,yes,yes,limited,limited,none,yes,No self-approval of finance or payouts
FINANCE_MANAGER,yes,none,none,none,read-limited,yes,yes,yes,yes,Finance actions require maker-checker and tenant scope
SUPPORT_AGENT,limited,none,limited,limited,yes,none,none,none,limited,Support access should minimize sensitive fields and be audited
AUDITOR_COMPLIANCE,read-only,none,read-only,read-only,read-only,read-only,read-only,none,yes,No operational mutations; exports must be tenant-scoped and logged
```

### docs/BATCH_25_SECURITY_ACCEPTANCE_TEST_MATRIX.csv

```csv
case_id,area,scenario,expected_result,execution_requirement,priority
AUTH-001,Authentication,Missing bearer token on protected API route,401 Unauthorized,Automated HTTP integration test,P0
AUTH-002,Authorization,Authenticated role omitted from route allowlist,403 Forbidden,Automated HTTP integration test,P0
TEN-001,Tenant isolation,Organization A reads Organization B resource by ID,Not found or forbidden without data leakage; no data returned,MySQL 8.4 integration test with two organizations,P0
TEN-002,Tenant isolation,Organization A mutates Organization B resource by ID,Request rejected and row unchanged,MySQL 8.4 integration test with before/after row assertions,P0
TEN-003,Tenant isolation,Organization context absent on tenant-owned service operation,Fail closed before query or mutation,Service unit test and HTTP integration test,P0
TEN-004,Tenant isolation,Nested resource belongs to a different organization,Reject before child mutation,MySQL 8.4 integration test,P0
TEN-005,Tenant isolation,Export request uses foreign tenant batch ID,No foreign data or signed download URL returned,HTTP integration test,P0
DEV-001,Device authentication,Missing or invalid x-device-secret on heartbeat/manifest/commands,401/403 and no state change,HTTP integration test,P0
DEV-002,Playback integrity,Duplicate event ID is submitted twice,Idempotent handling; no duplicate billable/rewardable event,MySQL 8.4 concurrency test,P0
DEV-003,Playback integrity,Device submits impossible timestamps or unknown campaign,Event rejected or quarantined and excluded from billing/rewards,Integration test with controlled fixtures,P0
FIN-001,Finance,Same user creates and approves own reward/payout,Approval rejected,Service and HTTP integration tests,P0
FIN-002,Finance,Two approvers decide the same pending item concurrently,Only one conditional transition succeeds; one audit decision,MySQL concurrency test,P0
FIN-003,Finance,Reward policy target is not met,Payable amount remains zero and calculation cannot be approved as eligible,MySQL integration test,P0
FIN-004,Finance,Provider callback replay or stale callback,Reject replay/stale callback without ledger mutation,Provider sandbox integration test,P0
FIN-005,Finance,Statement amount/reference mismatch,Discrepancy recorded for human review; no automatic ledger settlement,Provider sandbox integration test,P0
FIN-006,Finance,Live provider transfer flag absent or release checks incomplete,Transfer execution blocked,Negative release-gate test and live-provider mock test,P0
OPS-001,Operations,Untrusted upload URL points to private IP/metadata service,Reject URL before fetch; no outbound request,Security integration test after SSRF remediation,P0
OPS-002,Operations,Multiple API replicas run scheduler concurrently,Single logical assignment per scheduled window,Multi-process integration test after distributed locking/outbox hardening,P1
OPS-003,Audit,Unauthorized export/finance decision attempted,Denied action is logged without secrets or sensitive payloads,Audit integration test,P1
REL-001,Release,Fresh disposable MySQL 8.4 database applies all migrations,Migration completes and schema validates,CI integration job,P0
REL-002,Release,Required tests/builds or finance approvals are missing,Release gate remains blocked,CI release-gate test,P0
```

### docs/BATCH_28_CROSS_TENANT_TEST_MATRIX.csv

```csv
case_id,area,scenario,expected_result,persistence_assertion,priority
TEN-028-01,Campaigns,Organization A lists campaigns,Organization B campaign omitted,Foreign campaign ID absent from response,P0
TEN-028-02,CMS assets,Organization A lists assets,Organization B asset omitted,Foreign asset ID absent from response,P0
TEN-028-03,CMS layouts,Organization A lists layouts,Organization B layout omitted,Foreign layout ID absent from response,P0
TEN-028-04,Fleet,Organization A lists screens,Organization B screen omitted,Foreign screen ID absent from response,P0
TEN-028-05,Incidents,Organization A lists incidents,Organization B incident omitted,Foreign incident ID absent from response,P0
TEN-028-06,Finance,Organization A lists payout batches,Organization B batch omitted,Foreign payout batch ID absent from response,P0
TEN-028-07,Campaigns,Organization A updates Organization B campaign,404 Not Found,Campaign name remains unchanged,P0
TEN-028-08,CMS,Organization A publishes Organization B layout,404 Not Found,Layout remains DRAFT,P0
TEN-028-09,Fleet,Organization A changes Organization B screen status,404 Not Found,Screen remains ONLINE,P0
TEN-028-10,Incidents,Organization A resolves Organization B incident,404 Not Found,Incident remains OPEN,P0
TEN-028-11,Finance,Organization A approves Organization B payout batch,404 Not Found,Payout batch remains DRAFT,P0
```

### docs/BATCH_29_SECURITY_CONCURRENCY_TEST_MATRIX.csv

```csv
case_id,area,scenario,expected_result,verification_type,priority
SEC-029-01,Finance,Concurrent payout approval loses conditional update race,409 conflict and no approval audit from losing attempt,Unit plus MySQL concurrency,P0
SEC-029-02,Finance,Creator approves own payout batch,Forbidden and no transaction,Unit plus HTTP E2E,P0
SEC-029-03,Finance,Valid independent approver approves batch,Conditional transition and audit occur,Unit plus MySQL integration,P0
SEC-029-04,Campaigns,Foreign creative ID supplied in campaign update,Request rejected and foreign asset unchanged,HTTP E2E,P0
SEC-029-05,Scheduler,Foreign playlist assignment ID used with another screen,Request rejected and assignment unchanged,HTTP E2E,P0
SEC-029-06,Fleet,Foreign screen ID used for command/status,Request rejected and foreign screen unchanged,HTTP E2E,P0
SEC-029-07,Exports,Organization A exports payout data,Only Organization A rows included,HTTP E2E plus DB assertions,P0
SEC-029-08,Playback,Two concurrent identical event IDs,At most one persisted event for screen/event pair,MySQL concurrency E2E,P0
SEC-029-09,Playback,Duplicate or replay event returned by ingestion,Duplicate/rejected and never reward eligible,HTTP E2E plus DB assertions,P0
SEC-029-10,Finance,Two concurrent payout decisions,Only one legal state transition commits,MySQL concurrency E2E,P0
```

### docs/BATCH_30_SECURITY_ACCEPTANCE_MATRIX.csv

```csv
case_id,area,scenario,expected_result,verification_type,priority
SEC-030-01,Campaigns,Update campaign with foreign creative asset,Reject before any association write,Unit test,P0
SEC-030-02,Campaigns,Update campaign with foreign screen target,Reject before any association write,Unit test,P0
SEC-030-03,Finance export,Export foreign organization's payout batch,404/not found and no export transaction,Unit test,P0
SEC-030-04,Playback,Concurrent duplicate screen/event submissions,At most one row persists and only one event can qualify,MySQL concurrency E2E,P0
SEC-030-05,Playback,Duplicate event retry after initial persistence,Duplicate result never qualifies for rewards,HTTP E2E,P0
SEC-030-06,Finance,Two simultaneous approval requests,Only one transition succeeds and losing request has no audit,MySQL concurrency E2E,P0
SEC-030-07,Finance export,HTTP export response contains only same-tenant payout items,No foreign item IDs or owner IDs in payload,HTTP E2E,P0
SEC-030-08,Scheduler,Assign foreign playlist to organization screen,Reject before assignment upsert,Unit/HTTP E2E,P0
```

### docs/BATCH_31_SECURITY_ACCEPTANCE_MATRIX.csv

```csv
case_id,area,scenario,expected_result,verification_type,priority
SEC-031-01,Playback,Event ID already exists for screen,Return DUPLICATE and countedForEligibility false,Unit test,P0
SEC-031-02,Playback,Concurrent event insertion loses unique-key race,Map P2002 to DUPLICATE and countedForEligibility false,Unit plus MySQL concurrency E2E,P0
SEC-031-03,Playback,Invalid device secret,Reject before event lookup,Unit plus HTTP E2E,P0
SEC-031-04,Finance export,Batch item read,Filter nested items by authenticated organization,Unit plus MySQL integration,P0
SEC-031-05,Finance export,Export item query,Filter by payoutBatchId and organizationId,Unit plus MySQL integration,P0
SEC-031-06,Finance,Concurrent approval and reconciliation,Only legal conditional state transition persists,MySQL concurrency E2E,P0
SEC-031-07,Playback,Duplicate event attempts to qualify for owner reward,Never count duplicate result as eligible,Unit plus finance integration,P0
```

### docs/BATCH_32_SECURITY_ACCEPTANCE_MATRIX.csv

```csv
case_id,area,scenario,expected_result,verification_type,release_blocker
SEC-032-01,Playback authorization,Two different event IDs race for one playback authorization,Exactly one completion is eligibility-counted and the loser is rejected,Mocked Jest unit test,Yes
SEC-032-02,Playback idempotency,Previously stored event is submitted again,Duplicate is not eligibility-counted,Batch 31 unit test,Yes
SEC-032-03,Payout export,Export query loads payout items,All item reads constrained by authenticated organization,Source checker plus API test,Yes
SEC-032-04,Payout export,Export transition updates pending items,Update predicate contains batch and organization,Source checker,Yes
SEC-032-05,Payout approval,Two approval decisions race,One conditional transition and one audit record at most,Existing unit contract; MySQL E2E pending,Yes
SEC-032-06,Payout reconciliation,Two reconciliation requests race on same item,Terminal state cannot be overwritten and audit is persisted,MySQL E2E pending,Yes
SEC-032-07,Finance boundary,Provider transfer is requested before release gate approval,Live transfer remains disabled,Release-gate/manual integration verification,Yes
SEC-032-08,Tenant isolation,Organization A exports Organization B batch/items,No foreign batch or item data is returned,Existing HTTP security E2E plus export tests,Yes
```

### docs/BATCH_33_FINANCE_SECURITY_MATRIX.csv

```csv
case_id,area,scenario,expected_result,validation_type,status
FIN-033-01,reconciliation,Concurrent request changes payout item to PAID before stale FAILED update,Conditional update affects zero rows and conflict is raised,Unit test source,Added-not-executed
FIN-033-02,reconciliation,Concurrent request changes payout item to REVERSED before stale update,Terminal status is not overwritten,Unit test source,Added-not-executed
SEC-033-03,tenant isolation,Final payout-item read after reconciliation,Query includes payoutBatchId and organizationId,Static source check,Pass
SEC-033-04,tenant isolation,Provider submission updates exported payout items,Mutation includes payoutBatchId organizationId and expected prior status,Static source check,Pass
FIN-033-05,audit integrity,Stale reconciliation write loses conditional update race,No reconciliation success audit is created,Unit test source,Added-not-executed
FIN-033-06,release safety,Live provider transfer activation,Remains disabled pending release gate and provider acceptance,Operational control,Required
```

### docs/BATCH_34_FINANCE_CONCURRENCY_MATRIX.csv

```csv
ID,Scenario,Expected result,Audit expectation,Execution status
B34-01,Item became terminal before reconciliation conditional write,Conflict and transaction rollback,No success audit,Unit test added; execution pending
B34-02,Batch status changed before conditional batch transition,Conflict and transaction rollback,No success audit,Unit test added; execution pending
B34-03,Item and batch conditional transitions succeed,Reconciliation state returned,One reconciliation audit in transaction,Unit test added; execution pending
B34-04,Reconciliation item list includes foreign-tenant item,Reject before mutation,No audit,Existing tenant predicates retained
B34-05,Audit insert fails after state writes,Transaction rollback required,No committed state without audit,MySQL integration verification required
```

### docs/BATCH_35_FINANCE_AUDIT_ATOMICITY_MATRIX.csv

```csv
case_id,scenario,expected_result,validation_type,status
B35-01,Reconciliation batch lookup is organization scoped,Only requested organization's batch is returned,Static source plus Jest,Pending Jest execution
B35-02,Nested payout item relation read,Items include organization predicate,Static source plus Jest,Pending Jest execution
B35-03,Audit event insert fails,Service rejects and does not return success,Mocked unit test,Test authored not executed
B35-04,MySQL audit insert failure,Item and batch updates roll back,MySQL 8.4 integration,Pending
B35-05,Successful reconciliation,One audit record and matching item/batch states persist,MySQL 8.4 integration,Pending
B35-06,Cross-organization payout item,Item is never loaded or changed,MySQL 8.4 integration,Pending
B35-07,Live provider transfer,No transfer is invoked,Source inspection,Pending release review
```

### docs/BATCH_36_FINANCE_TRANSACTION_ACCEPTANCE_MATRIX.csv

```csv
ID,Area,Scenario,Expected result,Test layer,Status
B36-001,Database transaction,Audit foreign key fails after payout batch update,State update rolls back and no audit row persists,MySQL integration,Added not executed locally
B36-002,Database transaction,Valid payout batch update and audit insert,State and audit row persist together,MySQL integration,Added not executed locally
B36-003,Database safety,Non-MySQL DATABASE_URL,Suite refuses to run,Integration setup,Source assertion pending
B36-004,Provider safety,Integration suite execution,No provider or bank API invoked,Code review,Pass by design
```


### docs/BATCH_37_FINANCE_CONCURRENCY_ACCEPTANCE_MATRIX.csv

```csv
ID,Scenario,Expected Result,Verification
B37-01,Two transactions transition same expected payout batch state,Exactly one transaction commits,MySQL integration test
B37-02,Loser transaction attempts audit after stale conditional update,No loser audit is persisted,MySQL integration test
B37-03,Winner status transition,Status is PARTIALLY_RECONCILED,Reload persisted batch
B37-04,Winner audit record,Exactly one of the two action records exists,Count persisted audit rows
B37-05,Database URL uses PostgreSQL,Suite refuses to run,Guard assertion
B37-06,Database host is not localhost or 127.0.0.1,Suite refuses to run,Guard assertion
```

### docs/BATCH_38_RECONCILIATION_IDEMPOTENCY_MATRIX.csv

```csv
ID,Scenario,Expected result,Automated coverage,Release status
B38-01,Exact provider/payout pair appears twice in one statement,Second row is REFERENCE_MISMATCH,Unit test,Source added
B38-02,Same provider transaction reference is attached to different payouts,Later row is REFERENCE_MISMATCH,Unit test,Source added
B38-03,Amount differs from approved amount,AMOUNT_MISMATCH; no settlement,Existing unit test,Source present
B38-04,Statement is retried across separate requests,Durable import key prevents duplicate application,Database integration test required,Pending
B38-05,Persistence fails after discrepancy is recorded,Transaction rollback leaves no partial state,MySQL integration test required,Pending
B38-06,Foreign-tenant payout reference appears in statement,No cross-tenant mutation or disclosure,Security integration test required,Pending
```

### docs/BATCH_39_IMPORT_IDEMPOTENCY_ACCEPTANCE_MATRIX.csv

```csv
ID,Scenario,Expected result,Coverage,Status
B39-01,First request with new organization/provider/key,Creates one RECEIVED reservation,Unit test,Source added
B39-02,Same key and same payload after completion,Returns REPLAY and never re-applies rows,Unit test,Source added
B39-03,Same key but different payload,Returns PAYLOAD_CONFLICT,Unit test,Source added
B39-04,Duplicate request while RECEIVED/PROCESSING,Returns IN_PROGRESS,Unit test,Source added
B39-05,Unique conflict but no scoped row is found,Fail closed with error,Unit test,Source added
B39-06,Concurrent duplicate HTTP requests,One durable row,MySQL integration required,Pending
B39-07,Cross-tenant import lookup,No disclosure or mutation,Security integration required,Pending
B39-08,Crash during row application,All-or-nothing rollback,MySQL integration required,Pending
B39-09,Replay completed statement,No duplicate payout settlement,Service integration required,Pending
```

### docs/BATCH_40_ACCEPTANCE_MATRIX.csv

```csv
ID,Scenario,Expected result,Coverage,Status
B40-01,Finance manager reserves import with valid organization,One durable import record,Service unit test and schema,Source added
B40-02,Advertiser attempts reserve,Forbidden and no DB write,Service unit test,Source added
B40-03,Actor lacks organization context,Forbidden and no DB write,Service unit test,Source added
B40-04,Same key different payload,HTTP 409 payload conflict,Reservation helper unit test,Source present
B40-05,Same key currently processing,HTTP 409 in-progress,Reservation helper unit test,Source present
B40-06,Concurrent HTTP requests same key,Exactly one import row,MySQL integration required,Pending
B40-07,Cross-tenant lookup attempt,No disclosure,MySQL/security integration required,Pending
B40-08,Reservation endpoint receives payload,Only digest persisted,Code review/integration required,Pending
B40-09,Statement row application or payment,Not performed by this endpoint,Scope guard,Source present
```

### docs/BATCH_41_ACCEPTANCE_MATRIX.csv

```csv
ID,Scenario,Expected result,Coverage,Status
B41-01,Valid CSV and authorized finance actor,Persists row results and completion status transactionally,Service unit test,Source added
B41-02,Statement references payout item in same organization,Matcher compares reference amount currency and status,Service unit test + matcher unit,Source added
B41-03,Unknown payout item ID,Persists UNKNOWN_PAYOUT discrepancy only,Matcher logic,Source added
B41-04,Repeated idempotency key after completion,Returns REPLAY without transaction or duplicate rows,Service unit test,Source added
B41-05,Row insert or import completion fails,Transaction rolls back row writes and completion,MySQL integration required,Pending
B41-06,Concurrent duplicate submissions,Only one import is processed,MySQL integration required,Pending
B41-07,Foreign-organization payout item reference,Not found under organization predicate,Service code review/integration,Source added
B41-08,Statement says PAID,No payout item or ledger status changes automatically,Service unit test,Source added
B41-09,Malformed CSV,Import marked failed where possible and no partial rows persisted,MySQL integration required,Pending
```

### docs/BATCH_42_ACCEPTANCE_MATRIX.csv

```csv
ID,Scenario,Expected result,Automation status
B42-01,New idempotency key,Single worker claims RECEIVED reservation,Static guard + unit test
B42-02,Concurrent duplicate while lease active,Return IN_PROGRESS; no duplicate row persistence,Static guard; MySQL race test pending
B42-03,Retry after expired PROCESSING lease,Conditional lease claim succeeds for one worker,Static guard; MySQL race test pending
B42-04,Same key with changed payload,Payload conflict,Existing idempotency helper coverage
B42-05,Worker loses claim before commit,Transaction aborts and row inserts roll back,Unit guard added; transaction rollback integration test pending dependencies
B42-06,Foreign organization payout reference,No cross-tenant payout match,Existing organization-scoped query; runtime test pending
B42-07,Successful discrepancy processing,Rows and completion commit atomically,Existing processing test; execute pending dependencies
B42-08,Finance review outcomes,No payout status change or transfer,Source inspection
B42-09,Expired lease migration,MySQL 8.4 migration applies cleanly,Runtime migration test pending
```

### docs/BATCH_43_ACCEPTANCE_MATRIX.csv

```csv
ID,Scenario,Expected result,Test location,Execution state
B43-01,Two workers claim same RECEIVED import,Exactly one conditional update wins,test/reconciliation-import.mysql.e2e-spec.ts,CI runtime pending
B43-02,Two workers recover expired PROCESSING lease,Exactly one token becomes current,test/reconciliation-import.mysql.e2e-spec.ts,CI runtime pending
B43-03,Stale token tries to complete,Transaction rolls back inserted rows,test/reconciliation-import.mysql.e2e-spec.ts,CI runtime pending
B43-04,Completion compare-and-set fails,Rows and aggregate counters roll back,test/reconciliation-import.mysql.e2e-spec.ts,CI runtime pending
B43-05,Foreign tenant attempts claim or completion,Zero affected rows and original status unchanged,test/reconciliation-import.mysql.e2e-spec.ts,CI runtime pending
B43-06,Matched and discrepancy outcomes persisted,Rows and counts commit atomically,test/reconciliation-import.mysql.e2e-spec.ts,CI runtime pending
B43-07,Provider transfer side effects,No payout settlement or transfer is invoked,Source review,Static check
B43-08,Disposable database guard,Reject non-MySQL or non-local DB,BeforeAll guard,Static check
```

### docs/BATCH_44_ACCEPTANCE_MATRIX.csv

```csv
ID,Scenario,Expected result,Verification
B44-01,Finance reader fetches own import,200 with summary only,Unit test + API E2E
B44-02,Other organization fetches import,404 without cross-tenant disclosure,Unit test + MySQL E2E
B44-03,Fetch persisted statement rows,Rows ordered by rowNumber with total count,Unit test + MySQL E2E
B44-04,limit outside 1..200,400 Bad Request,Unit test
B44-05,offset outside 0..100000,400 Bad Request,Unit test
B44-06,Auditor reads reconciliation,Allowed by read role,Unit test + API E2E
B44-07,Advertiser attempts read,403 Forbidden,Unit test + API E2E
B44-08,Read endpoints affect finance balances,No mutation or transfer,Code review + integration test
B44-09,Raw CSV payload exposed,No raw payload or digest in read response,Code review + API response test
```

### docs/BATCH_45_ACCEPTANCE_MATRIX.csv

```csv
ID,Area,Scenario,Expected result,Test status
B45-01,Authentication,No bearer token on import detail,HTTP 401,Implemented - execution pending
B45-02,Authentication,No bearer token on import rows,HTTP 401,Implemented - execution pending
B45-03,HTTP read,Finance Manager reads completed import,HTTP 200 with persisted counts,Implemented - execution pending
B45-04,HTTP read,Finance Manager reads paginated discrepancy row,HTTP 200 with stable row order,Implemented - execution pending
B45-05,RBAC,Auditor reads import metadata,HTTP 200,Implemented - execution pending
B45-06,RBAC,Advertiser reads finance import,HTTP 403,Implemented - execution pending
B45-07,RBAC,Advertiser posts to process endpoint,HTTP 403,Implemented - execution pending
B45-08,Tenant isolation,Organization A reads Organization B import detail,HTTP 404,Implemented - execution pending
B45-09,Tenant isolation,Organization A reads Organization B import rows,HTTP 404,Implemented - execution pending
B45-10,Pagination,Limit greater than 200,HTTP 400,Implemented - execution pending
B45-11,Pagination,Negative offset,HTTP 400,Implemented - execution pending
B45-12,Integrity,Rejected reads do not mutate seeded rows,Counts unchanged,Implemented - execution pending
B45-13,Environment,Non-MySQL or non-local DB,Suite refuses to run,Implemented - execution pending
```

### docs/BATCH_46_ACCEPTANCE_MATRIX.csv

```csv
ID,Scenario,Expected result,Verification
B46-01,Malformed CSV failure,Stable STATEMENT_INVALID code,Unit test
B46-02,Lost processing claim,Stable CLAIM_LOST code,Unit test
B46-03,Database unavailable,Stable DATABASE_UNAVAILABLE code,Unit test
B46-04,Operational event allow-list,No raw exception or payload fields,Unit test
B46-05,Import failure persistence,lastErrorCode stores only a stable code,Source checker and runtime test
B46-06,Payout safety,No payout transfer initiated by observability code,Review
```

### docs/BATCH_47_ACCEPTANCE_MATRIX.csv

```csv
ID,Area,Acceptance criterion,Verification,Expected result,Live payout impact
B47-01,Static checks,All cumulative batch source checkers execute, npm run check:source,Exit code 0,No change
B47-02,Prisma,Prisma schema validates with installed dependencies,npx prisma validate,Exit code 0,No change
B47-03,Unit tests,Processing idempotency observability and read tests execute,Focused Jest command,All required tests pass,No change
B47-04,Database safety,Opt-in requires mysql scheme and local host,Release gate with RUN_MYSQL_FINANCE_E2E=1,Unsafe host rejected before tests,No change
B47-05,HTTP tests,Authenticated finance endpoints and tenant isolation execute,MySQL 8.4 HTTP E2E,All required tests pass,No change
B47-06,Concurrency,Claim and lease recovery tests execute,MySQL 8.4 integration suite,Single winner and stale-token rejection,No change
B47-07,Transparency,Skipped tests are not described as passing,Review release log,Skipped suites explicitly listed,No change
B47-08,Payments,No release gate code initiates payouts,Source review,No provider transfer calls,Live transfers remain disabled
```

### docs/BATCH_48_ACCEPTANCE_MATRIX.csv

```csv
ID,Area,Acceptance criterion,Verification,Status
B48-01,Runtime,Node major meets root engine requirement,verify:dependencies,Implemented
B48-02,Runtime,npm major meets root engine requirement,verify:dependencies,Implemented
B48-03,Workspaces,Every declared workspace has a package manifest and name,verify:dependencies,Implemented
B48-04,Lockfile,Committed lockfile uses npm lockfileVersion 3,verify:dependencies,Implemented
B48-05,CI,CI installs using npm ci after lockfile check,GitHub Actions workflow,Implemented
B48-06,Reproducibility,Root package-lock committed and reviewed,Maintainer action,Pending
B48-07,Runtime tests,Jest Prisma MySQL E2E and build suites run successfully,CI execution,Pending
```

### docs/BATCH_49_ACCEPTANCE_MATRIX.csv

```csv
ID,Area,Acceptance criterion,Verification,Status
B49-01,CI lockfile,CI fails clearly if root package-lock.json is missing,check-batch49.mjs,Static verified
B49-02,Install,CI installs with npm ci and never bootstraps lockfile,check-batch49.mjs,Static verified
B49-03,Runtime,Node and npm engine requirements remain checked,verify-dependency-install.mjs,Static verified
B49-04,Workspace,All declared workspaces have package manifests,verify-dependency-install.mjs,Static verified
B49-05,Runtime tests,Jest and MySQL 8.4 suites pass,CI runtime,Pending
B49-06,Release,Prisma validation and production builds pass,CI runtime,Pending
```

### docs/BATCH_50_ACCEPTANCE_MATRIX.csv

```csv
ID,Area,Acceptance criterion,Verification,Expected status in current environment
B50-01,Runtime,Node.js major version is 22 or newer,verify-clean-release.mjs,Executable preflight
B50-02,Package manager,npm major version is 10 or newer,verify-clean-release.mjs,Executable preflight
B50-03,Dependency reproducibility,Committed root package-lock.json exists and parses,verify-clean-release.mjs,Blocked until lockfile committed
B50-04,Workspaces,All declared workspace manifests exist,verify-clean-release.mjs,Executable preflight
B50-05,CI,CI uses npm ci and does not create a temporary lockfile,verify-clean-release.mjs,Executable preflight
B50-06,Source regression,Batches 01-50 static checks run,check:source,Must pass
B50-07,Runtime tests,Jest and E2E tests execute against disposable test services,CI,Pending runtime execution
B50-08,Database,Prisma validation and MySQL 8.4 migrations succeed,CI,Pending runtime execution
B50-09,Production build,API and web production builds succeed,CI,Pending runtime execution
B50-10,Payout safety,No live transfer enabled by reconciliation import processing,Code review and integration tests,Must remain disabled until approvals
```


## Historical documentation and manifest provenance

The following **163** files were consolidated out of the active tree. Their original contents remain accessible from the prior commit and immutable Git blobs. The path/size/hash list is a recovery index, not an approval register.

| Previous path | Git blob SHA-1 | Bytes |
| --- | --- | ---: |
| `BATCH_01_FILE_MANIFEST.txt` | `28d8303f027f9a1d324b9972312550a37e551589` | 878 |
| `BATCH_02_FILE_MANIFEST.txt` | `30f5ee0eedebfdb34ad1226afbc21e71a945f080` | 1610 |
| `BATCH_03_FILE_MANIFEST.txt` | `75dbe9048a4494c8ffc4b3b0eb94a543992fdab8` | 2177 |
| `BATCH_04_FILE_MANIFEST.txt` | `22b0e64418f8cb221c6af5dfd4bbde87ad846d78` | 2806 |
| `BATCH_05_FILE_MANIFEST.txt` | `3408144c6464600cddfbd7972715ee84835458d0` | 3296 |
| `BATCH_06_FILE_MANIFEST.txt` | `ba447eddfa2157c211417d3151c616a4769a7ef8` | 3803 |
| `BATCH_07_FILE_MANIFEST.txt` | `f7e4aeb59712d899f003856c8e2d88e8dea2664d` | 4202 |
| `BATCH_08_FILE_MANIFEST.txt` | `9a76e8253821f4ddff78177a6727bc7c0c4746b7` | 4624 |
| `BATCH_09_FILE_MANIFEST.txt` | `f61d9479639ee16d74d781d08c7b118818504813` | 4905 |
| `BATCH_10_FILE_MANIFEST.txt` | `8cf5c2f06446acfcc0f8a4e9b128585e7afc605f` | 5406 |
| `BATCH_11_FILE_MANIFEST.txt` | `3f0da8b886d20210685ff6ffb5491adb80099bea` | 5627 |
| `BATCH_12_FILE_MANIFEST.txt` | `c8d3cbe33b476b1eaf42cb501c9d09e6c7e0ce51` | 5775 |
| `BATCH_13_FILE_MANIFEST.txt` | `76035aac6105c41e8bd5a099c6d2260eebfa65d0` | 1533 |
| `BATCH_14_FILE_MANIFEST.txt` | `6db965e741995bed0e718a20caa5818a0304ad08` | 18003 |
| `BATCH_15_FILE_MANIFEST.txt` | `54da61fab1b49093e3208a17e8178abd296e7449` | 1272 |
| `BATCH_15_SOURCE_FILE_LIST.txt` | `780b546eb0c963841229813be311cc70c8438f45` | 6580 |
| `BATCH_16_FILE_MANIFEST.txt` | `66edaec1cebab5221114d5eedfe32ba525ec5271` | 20094 |
| `BATCH_17_FILE_MANIFEST.txt` | `ab89cd9665b2b9acd940db53185ac86b057b742e` | 7752 |
| `BATCH_17_MIGRATION_SHA256.txt` | `d8dd075dfa0e01000e7b4f9e35dba18ba6fd4e20` | 142 |
| `BATCH_18_FILE_MANIFEST.txt` | `f53e345b2c46434a86eca94148e6299dfabd702e` | 10404 |
| `BATCH_19_FILE_MANIFEST.txt` | `232cf9b3ccbd9c7c1371640117859e2198f36ee7` | 23253 |
| `BATCH_20_FILE_MANIFEST.txt` | `1dca8a622d7cec5126a4d1f284f5fe0c17260225` | 24026 |
| `BATCH_21_FILE_MANIFEST.txt` | `e1611e809d4a7aa6e6bbb82d64a5c7a6c468d919` | 28946 |
| `BATCH_22_FILE_MANIFEST.txt` | `5ba7584650e3411055a790c8660280fa7755a5f6` | 29457 |
| `BATCH_23_FILE_MANIFEST.txt` | `6f843f4035f18315d58ec5c40c93133a465d4d90` | 30347 |
| `BATCH_24_FILE_MANIFEST.txt` | `47dbe94c5fcaca74d68f4b833c9c4a7ae0bac5f6` | 31214 |
| `BATCH_25_FILE_MANIFEST.txt` | `f2346eb83e27281a7e7e05fc01a3cb09544b57f0` | 27162 |
| `BATCH_26_FILE_MANIFEST.txt` | `0a206ad7c319bf2a782d10129dbca04416357291` | 27570 |
| `BATCH_27_FILE_MANIFEST.txt` | `2e2c554e602f5c38b907fa80e1a1379d3aeabea6` | 27958 |
| `BATCH_28_FILE_MANIFEST.txt` | `85bf9eb8993e9652d79c1555f2ab65912bc3252a` | 28364 |
| `BATCH_29_FILE_MANIFEST.txt` | `bf75ea8e9c72495a8aaf656f0e727a58a96e03f4` | 28888 |
| `BATCH_30_FILE_MANIFEST.txt` | `4192f2a47a4d4bdc8b5c0d177a374f5a440a3f24` | 29534 |
| `BATCH_31_FILE_MANIFEST.txt` | `81c67bd9c38e2d0f62acff573dba7eeb9c6f718f` | 30073 |
| `BATCH_32_FILE_MANIFEST.txt` | `01e9bf0a514866a0c42c2fa7660756c495af07c8` | 30618 |
| `BATCH_33_FILE_MANIFEST.txt` | `e7749a7c4e2b4a90c8224f6c08c1791b040fb4e3` | 31156 |
| `BATCH_34_FILE_MANIFEST.txt` | `8d18d01e09bfcbaafc6c63479ed9b7706724fd6a` | 31564 |
| `BATCH_35_FILE_MANIFEST.txt` | `0533a3598766282a8ef4728150f7919ac9b39ea7` | 32103 |
| `BATCH_36_FILE_MANIFEST.txt` | `b225126166270d424ea8034a4368b58e5bf4b891` | 32647 |
| `BATCH_37_FILE_MANIFEST.txt` | `218751efb30751ccc6c7b2c3abd50e526858c9b7` | 33069 |
| `BATCH_38_FILE_MANIFEST.txt` | `37e22abaa9a0398ef9061c9916707671c3918d92` | 33482 |
| `BATCH_39_FILE_MANIFEST.txt` | `6793fcf1dc746c4b69a4eda5abab21be6a8d2778` | 34326 |
| `BATCH_40_FILE_MANIFEST.txt` | `6f4e467b1775cb2bf72f2cab65a302c544d9385f` | 35270 |
| `BATCH_41_FILE_MANIFEST.txt` | `87c1073e3861a531ac198264be08913ab1882234` | 35961 |
| `BATCH_42_FILE_MANIFEST.txt` | `8e17cd63a67d825dc7f35b6988e49242bb9b87c6` | 961 |
| `BATCH_43_FILE_MANIFEST.txt` | `85bd64b25bbde822f81aae1c4b730a2c8a1a7997` | 631 |
| `BATCH_44_FILE_MANIFEST.txt` | `0efb2ccf8584de9b0c0a6683c30fbac6b2d73d70` | 1111 |
| `BATCH_45_FILE_MANIFEST.txt` | `b88ff4b66d8fa237dd8710332c694b2b737b29d8` | 656 |
| `BATCH_46_FILE_MANIFEST.txt` | `6cd3670690bc8cd43816301fbe85393b1c717058` | 552 |
| `BATCH_47_FILE_MANIFEST.txt` | `525db703775a74dd614cc5685d2cab04a543efaa` | 672 |
| `BATCH_48_FILE_MANIFEST.txt` | `1944a0bebf1533911aa5a13f1bdc6c7966dcec6d` | 612 |
| `BATCH_49_FILE_MANIFEST.txt` | `81247cae1990ce216201d35b2321a9bdef183430` | 481 |
| `BATCH_50_FILE_MANIFEST.txt` | `781742bced8a1b4981928808a252c9e57fd505fe` | 562 |
| `docs/BATCH_01_ACCEPTANCE.md` | `f2d7ac5cdca28a2ff74416925171dbbc28c156dd` | 1260 |
| `docs/BATCH_02_AUTH_SECURITY.md` | `34d57a1eefb8b12fc6335b18c106f0d0c0384bec` | 3741 |
| `docs/BATCH_02_TEST_PLAN.md` | `839329bac8b8ce70c57c2eeb930c11e49f1c0d23` | 1456 |
| `docs/BATCH_03_CMS_MEDIA_LAYOUTS.md` | `39a7b0546a51b9df00c74966f2f79c9566f57f4a` | 3138 |
| `docs/BATCH_03_TEST_PLAN.md` | `a76a362af13276042182d67edd622f5528aab9c9` | 1808 |
| `docs/BATCH_04_DEVICE_FLEET.md` | `7ff28a201a4b004583c9391157b5ab0c1ca491e1` | 2987 |
| `docs/BATCH_04_TEST_PLAN.md` | `a3866bcadb07b2654ccccae485112d7f353a0a1f` | 1544 |
| `docs/BATCH_051_101_SOURCE_BLOCKERS.md` | `e87296a3dd03ba6d8d05fd5a8beecc6d1d3c8687` | 751 |
| `docs/BATCH_05_PLAYBACK_PROOF_OF_PLAY.md` | `04812f485d22a89314a9e60afa61254b66fced14` | 3604 |
| `docs/BATCH_05_TEST_PLAN.md` | `b32e16416c32ddc6593bf851511ac9f0fa02e82f` | 1913 |
| `docs/BATCH_06_CAMPAIGN_MANAGEMENT.md` | `77dec90aed71f2a9e4c384575e9ffc30c05419ed` | 2930 |
| `docs/BATCH_06_TEST_PLAN.md` | `4bac0e7b09d995ddd5cbd44773c8676728b3b6f5` | 1899 |
| `docs/BATCH_07_DELIVERY_ENGINE.md` | `fb88ba08bca9f34380ece26a92983e3e8dafe804` | 3032 |
| `docs/BATCH_07_TEST_PLAN.md` | `5040ed24c6297475ca87cfed4ba18b6f8055e124` | 2004 |
| `docs/BATCH_08_SCHEDULER_PLAYLIST_SYNC.md` | `aa4685c1ab898c5664a14d8391d6cc014977389d` | 3010 |
| `docs/BATCH_08_TEST_PLAN.md` | `cefe06b22bf75d555bc77af8efdcf8874431ea96` | 2018 |
| `docs/BATCH_09_OFFLINE_RECOVERY_DEVICE_HEALTH.md` | `b3b440a030de699b73a461ee69a4edb14cfaf49a` | 2829 |
| `docs/BATCH_09_TEST_PLAN.md` | `592b1eec993789e99b7104f0374029f031e1fa6c` | 2152 |
| `docs/BATCH_102_150_RECOVERED_DOMAIN_INTEGRATION.md` | `afe2a1b42be0fc67168081cc40c318fd5e937005` | 8689 |
| `docs/BATCH_102_150_SOURCE_INVENTORY.md` | `3598414453b9d51f2dcb3940e335989b41e2cf0d` | 6328 |
| `docs/BATCH_10_API_EXAMPLES.md` | `8dd81dd2f445e4b2fccca1802ac5b508aad7a99c` | 1214 |
| `docs/BATCH_10_LIVE_OPERATIONS_INCIDENTS.md` | `2435527c8f62b5fb55ef967bdda437a08b2d70ac` | 3183 |
| `docs/BATCH_10_TEST_PLAN.md` | `61b51599d9ff18f95d18b013994eb82ee6f51149` | 2038 |
| `docs/BATCH_119_124_POLICY_INTEGRATION.md` | `c2aaafa98e1f7a6ec5861f8b506dc586cf7effba` | 1839 |
| `docs/BATCH_11_LIVE_API_AUTOMATION.md` | `42631976b0cf3474c991f18e103a43c19b2733eb` | 4049 |
| `docs/BATCH_11_TEST_PLAN.md` | `c217fb6c0b2bb873287f7df1065ee08f9f4ce078` | 2689 |
| `docs/BATCH_125_POLICY_INTEGRATION.md` | `67c561e4229f0db7cf863b2dab2664a7618bdef7` | 1862 |
| `docs/BATCH_126_COMMAND_ANALYTICS_INTEGRATION.md` | `bbe72479937f535056fc528d75036cc193b2552a` | 2456 |
| `docs/BATCH_127_FLEET_OPERATIONS_INTEGRATION.md` | `64dd6796cccd1f3f34ee00d10ee231000815622d` | 1463 |
| `docs/BATCH_128_INCIDENT_REVIEW_INTEGRATION.md` | `2a07e65aad5147a87f30e5f23f9df3661ca0fb23` | 2042 |
| `docs/BATCH_129_FLEET_RELIABILITY_MAINTENANCE.md` | `f4c30d83b5d8a6e6508cd6d9e9f26894d136efed` | 1799 |
| `docs/BATCH_12_SECURITY_HARDENING.md` | `a44e0f91e8384083880e6bfd538d81c10cdabddd` | 3556 |
| `docs/BATCH_12_TEST_PLAN.md` | `7f35a2860c231d18435beb3d74d0bbb0b3b21f95` | 2077 |
| `docs/BATCH_130_MAINTENANCE_OPERATIONS.md` | `4f4b1d42102f69a7dd06e37a754c9b42889085b9` | 2057 |
| `docs/BATCH_133_MAINTENANCE_CONTROL_CENTER.md` | `09addcbf865491625f05779ac6a9883749f532ac` | 1982 |
| `docs/BATCH_134_MAINTENANCE_CALENDAR.md` | `82a1d1afa1f28bb3880c54d0d198450e6d8c5fe9` | 2225 |
| `docs/BATCH_136_150_CONSOLIDATED_RECOVERY.md` | `b6a1ee56224dc466273fe4da82430348a63b9f1f` | 3369 |
| `docs/BATCH_13_CI_CD_PRODUCTION_READINESS.md` | `696acab1b43cd028531857ace6bcc70a156206c9` | 3405 |
| `docs/BATCH_13_TEST_PLAN.md` | `973e34ecc5faa41ef42dd0433e4c72bdd5fb9e5a` | 1655 |
| `docs/BATCH_14_DEPLOYMENT_OBSERVABILITY_RECOVERY.md` | `d02edb0f30476b23034402b8ea9168b554e6e3ae` | 4540 |
| `docs/BATCH_14_TEST_PLAN.md` | `a750aad56758f4341c8b8b2eb4dea42f039d376d` | 1170 |
| `docs/BATCH_15_MONITORING_AUDIT_FINANCIAL_CONTROLS.md` | `848554558019b6cb05d4ec5e79ba209665929a9d` | 2906 |
| `docs/BATCH_15_TEST_PLAN.md` | `a8a6cf03a72a10680f756c62096a0fa7b9ae03b5` | 1462 |
| `docs/BATCH_16_FINANCE_LEDGER_REWARD_ELIGIBILITY.md` | `73f5204c6e8068b7367843010f896bf7b178a04e` | 3845 |
| `docs/BATCH_16_TEST_PLAN.md` | `8cf9d0fbeadbd215321906f0ee2d2ce7d6f42668` | 1666 |
| `docs/BATCH_17_PAYOUT_RECONCILIATION_DISPUTES.md` | `dfe2080bb1407b93a92abbfe5a2ccb39226d232e` | 4402 |
| `docs/BATCH_17_TEST_PLAN.md` | `55ec1f35b929a63bd54b13d082b505999c175a06` | 1551 |
| `docs/BATCH_18_PROVIDER_INTEGRATION.md` | `4bb16b925c88d6acbd694d1b5a26b5d5691b5228` | 3703 |
| `docs/BATCH_18_TEST_PLAN.md` | `c8120e579c58859a36e9271612e0f87bdb42edce` | 875 |
| `docs/BATCH_19_SANDBOX_PROVIDER_RECONCILIATION.md` | `2df5883023d09e73603a2ca74e27d8426d3ee13c` | 2319 |
| `docs/BATCH_20_PROVIDER_ACCEPTANCE_RELEASE_GATE.md` | `678ab5d82cd0ace68b1f8926ac2b5ccdfcc31a87` | 2314 |
| `docs/BATCH_21_E2E_TENANT_ISOLATION_PRODUCTION_ACCEPTANCE.md` | `84ce1ef4c2711828484d5614612292b59ac2af9a` | 7226 |
| `docs/BATCH_21_ROLE_PERMISSION_REGRESSION_MATRIX.csv` | `c4f810c7131dc201bc1d01faf49819c3768b56cd` | 1709 |
| `docs/BATCH_22_SERVICE_TENANT_ISOLATION_REMEDIATION.md` | `99cc5ae8cb2c00850d49e7205af5719bf19e43b6` | 5531 |
| `docs/BATCH_22_TENANT_ISOLATION_REGRESSION_CASES.csv` | `e9a1b85547874bcdecebf06639cf6c801618e676` | 2084 |
| `docs/BATCH_23_AUTOMATED_TENANT_REGRESSION_QA.md` | `463610ea234979f9b68a6c01a92dfcdf6dd1e02e` | 2432 |
| `docs/BATCH_23_TENANT_TEST_CASES.csv` | `f8eb2d07846f9ec84d4194d98da36111a5f7f4da` | 1684 |
| `docs/BATCH_24_AUTHORIZATION_COVERAGE_AND_REMEDIATION.md` | `b997c1baf3bd5df7f5bf8b9637bf9ebf7b4558b6` | 3448 |
| `docs/BATCH_24_AUTHORIZATION_TEST_MATRIX.csv` | `a50cc0ba1c1d9f3e799a1105ac3633e456cc28fc` | 1515 |
| `docs/BATCH_25_AUTHORIZATION_INTEGRATION_ACCEPTANCE.md` | `97dab05d16f6f450db8abeadb80b902904615c09` | 3194 |
| `docs/BATCH_25_ROLE_PERMISSION_ACCEPTANCE_MATRIX.csv` | `272ae2fbaecfbc1d9c51181c6a49c7ab9b950b60` | 1289 |
| `docs/BATCH_25_SECURITY_ACCEPTANCE_TEST_MATRIX.csv` | `e6684848830bb9b4c0365f67b3b8a06e3e39f3dd` | 3302 |
| `docs/BATCH_26_AUTHORIZATION_TEST_EXECUTION.md` | `c5a81c4569fc8637c822fda5126de2127f7ce024` | 2128 |
| `docs/BATCH_27_MYSQL_SECURITY_E2E.md` | `e55b28d9b00f4608bdd6508662d68c15dd887158` | 2129 |
| `docs/BATCH_28_CROSS_TENANT_PERSISTENCE_E2E.md` | `a933f67a29ddae4731afe1bd650e38a8b35ccd39` | 2149 |
| `docs/BATCH_28_CROSS_TENANT_TEST_MATRIX.csv` | `3ee2bfed79d2555c8ada051905a65d9faa7c1e92` | 1367 |
| `docs/BATCH_29_CONCURRENCY_EXPORT_SECURITY.md` | `1e0a44fd479d903821a3becc7ddc9c6e2997065c` | 2108 |
| `docs/BATCH_29_SECURITY_CONCURRENCY_TEST_MATRIX.csv` | `c4f6c7cb0daa19145f70550db3fa14802f7ce93c` | 1345 |
| `docs/BATCH_30_NESTED_RESOURCE_EXPORT_TESTS.md` | `d3a2b46985075d9cbbabd0ed918bafbd3c387d7e` | 1628 |
| `docs/BATCH_30_SECURITY_ACCEPTANCE_MATRIX.csv` | `d4206d509622efac04f2b4613d86fc83f9fbe392` | 1085 |
| `docs/BATCH_31_PLAYBACK_IDEMPOTENCY_EXPORT_TENANT.md` | `46aa893a8acc60794694a35a12ef2ba6e32f6f1c` | 1577 |
| `docs/BATCH_31_SECURITY_ACCEPTANCE_MATRIX.csv` | `91ed523fd4ca4890e1bd001a587cc552f5f03438` | 952 |
| `docs/BATCH_32_CONCURRENCY_AND_FINANCE_ACCEPTANCE.md` | `2caca2e00a35f82bcd6411005942ebaea1b66140` | 2761 |
| `docs/BATCH_32_SECURITY_ACCEPTANCE_MATRIX.csv` | `cc32c706c6d88e206f61e10bd7e0dcaecf9b94d3` | 1334 |
| `docs/BATCH_33_FINANCE_SECURITY_MATRIX.csv` | `7fdcae57c9f0680887838da04f9f1be1bf699917` | 1060 |
| `docs/BATCH_33_PAYOUT_RECONCILIATION_RACE_HARDENING.md` | `ac599dfa11c43ddd97215998ac35f32afbd1820c` | 1429 |
| `docs/BATCH_34_BATCH_TRANSITION_CONCURRENCY.md` | `c8a2c493d5236d6c31ee6650ac440d6112b4c5a2` | 1866 |
| `docs/BATCH_34_FINANCE_CONCURRENCY_MATRIX.csv` | `3f675e7e1b5627adcf937b4bbe5b67e16bec42f2` | 803 |
| `docs/BATCH_35_FINANCE_AUDIT_ATOMICITY_MATRIX.csv` | `5a2dbefde1785d4fdc758e5e761ca902e77a5841` | 863 |
| `docs/BATCH_35_RECONCILIATION_AUDIT_ATOMICITY.md` | `4d28df89b69ccd8b12718f23c1b9bf588bbfd28f` | 2113 |
| `docs/BATCH_36_FINANCE_TRANSACTION_ACCEPTANCE_MATRIX.csv` | `26179f1e0bb8a5584c12cf8b84e2787b628ec744` | 601 |
| `docs/BATCH_36_MYSQL_FINANCE_TRANSACTION_ATOMICITY.md` | `a0a08d48423de6161139457805ef19b0662f0ddc` | 1676 |
| `docs/BATCH_37_FINANCE_CONCURRENCY_ACCEPTANCE_MATRIX.csv` | `72487bbe8f5ed10564c5cf04e767c215d1b9edac` | 632 |
| `docs/BATCH_37_MYSQL_CONCURRENT_RECONCILIATION.md` | `8c20e0520ba2c30268df4913a0bc86b88d9b61c0` | 1578 |
| `docs/BATCH_38_RECONCILIATION_IDEMPOTENCY.md` | `a1047126dd4337160a63220265eab696741fd3bb` | 1965 |
| `docs/BATCH_38_RECONCILIATION_IDEMPOTENCY_MATRIX.csv` | `c75d7516e60d75f6b16b373fd0ee802c672fa661` | 850 |
| `docs/BATCH_39_DURABLE_IMPORT_IDEMPOTENCY.md` | `203107195e0265e355abbc71dc1751d31ba4ddd3` | 1944 |
| `docs/BATCH_39_IMPORT_IDEMPOTENCY_ACCEPTANCE_MATRIX.csv` | `3822c581d386d8836b071a0e190cccbcd831a342` | 934 |
| `docs/BATCH_40_ACCEPTANCE_MATRIX.csv` | `d37bbb7d1d221b094f0c0e9ddcf9a78d341a97ec` | 972 |
| `docs/BATCH_40_RECONCILIATION_IMPORT_ENDPOINT.md` | `068f49b7a13407261a3618b97e22a64eeec611e4` | 1646 |
| `docs/BATCH_41_ACCEPTANCE_MATRIX.csv` | `7c90f74dc6c417be5d387c16930851fa85e72f24` | 1173 |
| `docs/BATCH_41_TRANSACTIONAL_RECONCILIATION_PROCESSING.md` | `e9f987c983751a7557acb59bcc53834fd9b697c4` | 1997 |
| `docs/BATCH_42_ACCEPTANCE_MATRIX.csv` | `72b677e43d47a1aa792f920162c2758a0ceecf62` | 1105 |
| `docs/BATCH_42_SAFE_IMPORT_RECOVERY.md` | `7b650cc88ec2d95b47e411d4ab3c6a949e55289a` | 2420 |
| `docs/BATCH_43_ACCEPTANCE_MATRIX.csv` | `501a1e97fd0d563438fd4b43d8574630bac76d8e` | 1150 |
| `docs/BATCH_43_MYSQL_RECONCILIATION_INTEGRATION.md` | `975909fc6eafea0a94923ea999aef8d1251be298` | 1695 |
| `docs/BATCH_44_ACCEPTANCE_MATRIX.csv` | `8cacb8cdc34bfa65c6799d05c4a11fb02780069e` | 787 |
| `docs/BATCH_44_RECONCILIATION_READ_API.md` | `8fa61fab6556a23474b1e7d4bb09000661fb0abf` | 2093 |
| `docs/BATCH_45_ACCEPTANCE_MATRIX.csv` | `c07a3eede622b7c1fdf29e9a6dfabd0a24bc0eda` | 1330 |
| `docs/BATCH_45_RECONCILIATION_HTTP_E2E.md` | `b3e893152210d7791c8854e0a02df7a4a40788a6` | 2214 |
| `docs/BATCH_46_ACCEPTANCE_MATRIX.csv` | `5c30b31770500b12cc409e920bbb9ba162f2634f` | 509 |
| `docs/BATCH_46_RECONCILIATION_OBSERVABILITY.md` | `89e266070a22d1fb226d3bbcd12825e50065b936` | 1528 |
| `docs/BATCH_47_ACCEPTANCE_MATRIX.csv` | `457e3121d3bce8719782ec4adcbb535361157980` | 1101 |
| `docs/BATCH_47_RELEASE_GATE.md` | `e2b4de2dd86967aa454b96d9f72cf37ccb45959a` | 2699 |
| `docs/BATCH_48_ACCEPTANCE_MATRIX.csv` | `66e25ceac0c4040e3c377a70a709cdacaa9ae0a5` | 705 |
| `docs/BATCH_48_CLEAN_CI_DEPENDENCY_HARDENING.md` | `2ae3f1657d710b5d7cc83f0d6c6b59d0da94df5c` | 1559 |
| `docs/BATCH_49_ACCEPTANCE_MATRIX.csv` | `e381d20ba5deaeb1dd921b04c23eceffad9ac9d5` | 628 |
| `docs/BATCH_49_FAIL_CLOSED_CI_AND_LOCKFILE_POLICY.md` | `483c60e6dfc8226d500a9c79c32ffdebdf2f6fc1` | 1570 |
| `docs/BATCH_50_ACCEPTANCE_MATRIX.csv` | `b718e58db797ce8fa234a2f061557e60a1a9f4d3` | 1169 |
| `docs/BATCH_50_CLEAN_RELEASE_PREFLIGHT.md` | `74194b92398c0d21c9e75e2d1868bdf9e3154e71` | 1600 |
| `docs/recovery/BATCH-135-TECHNICIAN-WORKSPACE.md` | `8976c50bc90276b029dec23317acc5d6c73727b6` | 1564 |

## Current engineering navigation

- [Development SRS acceptance/gap matrix](SRS-V1-TRACEABILITY.md)
- [Implementation backlog](SRS-V1-DELIVERY-BACKLOG.md)
- [Business-rule approvals](BUSINESS-RULES-REGISTER.md)
- [Current UAT checklist](UAT-CHECKLIST.md)
- [Production runbook](PRODUCTION-RUNBOOK.md) / [release signoff](RELEASE-SIGNOFF.md)
- [Repository structure](REPOSITORY-STRUCTURE.md)

## Superseded milestone register recovery

- Original path: `docs/MILESTONE_REGISTER_001_150.csv`
- Original blob SHA: `85827024aeb36ad524a9af52f6fea87495f20ba3`
- Original size: 30,072 bytes
- Source commit: `8676cb2b54a75ad26ad9d14d8f2cbd92e4dd3450` (`git show 8676cb2:docs/MILESTONE_REGISTER_001_150.csv`)
- Reason for retirement: old source-recovery status snapshots mix historical “starter not integrated / tests not run” entries with newer acceptance evidence; they must not be treated as live implementation states. Current functionality is assessed by canonical code, tests, exact-SHA CI and the client SRS traceability document.
