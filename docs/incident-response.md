# Incident response & recovery runbook

Public summary: Trust Center → Incident response & continuity
(`src/components/views/trust-view.tsx`). Keep the two in step.

## Severity

| Sev | Meaning | Acknowledge |
|---|---|---|
| 1 | Site down, data exposed, or account takeover | 1 hour |
| 2 | Major feature broken (submission, payments, sign-in) | 4 hours |
| 3 | Minor defect or degraded performance | 2 working days |

## Steps

1. **Detect & triage.** Sources: status page health checks, Vercel runtime
   errors, security.txt reports, user reports. Record time, reporter, scope.
2. **Contain.** Roll back the deployment (Vercel → Deployments → Promote the
   previous good one), disable the affected feature, revoke sessions
   (rotate `SESSION_SECRET`), rotate any exposed API key in Vercel
   environment variables.
3. **Notify.** If personal data may be affected:
   - Philippines: National Privacy Commission within **72 hours** of
     knowledge (NPC Circular 16-03), and affected data subjects.
   - EU/UK: the lead supervisory authority within 72 hours (GDPR Art. 33),
     and data subjects without undue delay when the risk is high (Art. 34).
   - Whitelabel tenant data: the tenant's administrator as well.
4. **Recover.** Redeploy known-good code; restore data if needed (below);
   verify sign-in, submission, article pages and PDFs.
5. **Learn.** Post a plain-language summary on the status page within 5
   working days; file follow-up fixes.

## Recovery targets

- **RPO ≤ 24 h** — managed Postgres provider backups / point-in-time recovery.
- **RTO ≤ 4 h** — from decision to restore to service verified.

## Database restore (managed Postgres)

1. In the database provider's console, create a **branch / restore** from the
   desired point in time (never restore over production directly).
2. Point a Preview deployment at it (`POSTGRES_PRISMA_URL`,
   `POSTGRES_URL_NON_POOLING` for the Preview environment) and verify.
3. Swap Production's variables to the restored database, redeploy, verify.
4. Keep the old database read-only for 14 days for forensics.

## Restore drill

Quarterly: run steps 1–2 against a Preview deployment, time it, and record
the date and duration here.

| Date | Duration | Notes |
|---|---|---|
| | | First drill pending |
