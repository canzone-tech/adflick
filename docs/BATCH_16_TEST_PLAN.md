# Batch 16 test plan

## Automated tests
- Reject requests when no organization context exists or role is not authorized.
- Reject invalid period ranges and disabled/missing policies.
- Count only accepted `PLAY_COMPLETED` events inside `[periodStart, periodEnd)`.
- Check TV and smartphone thresholds independently.
- Hold missing owners, unrecognized device platforms and policies requiring unavailable uptime evidence.
- Ensure rerunning a period cannot overwrite pending, approved, rejected or reversed calculations.
- Prevent an approver from deciding their own request.
- Verify approval transaction creates exactly one ledger accrual (unique idempotency key) and rejected/held requests create none.
- Verify cross-organization IDs cannot be queried or approved.
- Verify policy changes and all approval decisions create audit events.

## Manual acceptance
1. Configure policy with reward disabled; calculation endpoint must refuse to run.
2. Enable policy and create sample screens with distinct TV/mobile platform identifiers and test playback events.
3. Calculate the period and compare exact counts to the playback report.
4. Confirm under-target devices have amount zero and no approval action.
5. Request approval as User A, attempt approval as User A (must fail), then approve as User B.
6. Confirm one ledger row exists and no payout or bank transfer was triggered.
7. Reject/hold a separate calculation and confirm no ledger accrual exists.
8. Attempt cross-organization access and confirm no data leakage.
9. Run `npx prisma validate`, `npx prisma generate`, migrations against disposable MySQL 8.4, API/web type checks, lint, Jest, and full builds.
