# Compliance Register

Private area for the platform owner (SUPER_ADMIN, platform site only):
Dashboard → Platform Administration → **Compliance Register**.

It holds the records behind the Trust page and the CSA STAR self-assessments:

- **Policy Library** — 19 starting drafts (`src/lib/compliance-policy-drafts.ts`),
  loaded on request as DRAFTs. A policy is adopted only by the owner, and only
  when no `[CONFIRM: …]` note is left in its text (checked on screen and on the
  server). Adopting dates it and sets the next review (default 12 months).
  Recording a review is the owner's own act; the register never creates one.
- **Devices** — one checklist per laptop/phone used for platform work.
- **Reminders** — a weekly in-app/email nudge from `/api/cron/sweep-all`
  when a review or device check is due within 30 days or overdue.

Public side: `GET /api/trust/register` feeds the Trust page's "Policy register".
It returns titles, versions and dates of **adopted, public** policies only —
never a draft, a policy's text, or anything about devices. An overdue review is
shown as overdue.

Every change is written to the audit log (`entityType: COMPLIANCE`).

Each draft lists the STAR question IDs (`covers`) whose answer relies on it, for
the yearly STAR refresh. Later phases add the risk, supplier, key, exercise,
incident and AI registers to the same area.
