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

## Phase 2: records, suppliers, keys, access reviews and exercises

One generic table (`ComplianceRecord`) holds six kinds. Field definitions live in `src/lib/compliance-records.ts`; starting records in `src/lib/compliance-record-seeds.ts`.

| Kind | What it is | How it is dated |
| --- | --- | --- |
| Risk | The risk register | Owner confirms, then records a review each year |
| Assessment | DPIA, AI impact assessment, threat model | Same |
| Supplier | Outside services that handle data | Same. A confirmed supplier the owner marks public appears on the Trust page as a sub-processor (name, purpose, data, place only) |
| Key | Key and secret inventory (names only, never values) | "Record rotation" |
| Access review | Yearly check of who holds an administrator or editor role. A button loads the live list | Entered with the date it was done; cannot be edited afterwards |
| Exercise | Restore drill, incident walk-through | Entered with the date it was done; cannot be edited afterwards |

Rules:
- Starting records load as drafts and cannot be confirmed while any `[CONFIRM: …]` note or required field is open (checked on screen and on the server).
- Editing a confirmed record sends it back to draft until the owner confirms the new wording.
- Only the latest access review and the latest exercise of each type count for "is it due". Reminders for them start once at least one policy is adopted.
- "Adopt all ready policies" adopts every draft with no open notes in one owner act, each dated, recorded as a review and written to the audit log. Drafts with notes are skipped.
- Not built yet: automatic re-encryption when the field-encryption key changes (the plan is that people reconnect linked accounts) and role grants that expire by themselves.
