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

## Phase 3: incidents, alerts, AI guards and model checksums

No new database tables. Everything below is honest about what it does and does not do.

- **Incident register** (`INCIDENT` kind in `ComplianceRecord`). Logged once resolved, with the date it was noticed, severity, what happened, who was affected and what changed. The resolved date cannot be earlier than the noticed date or in the future. Entries cannot be edited. The page shows the count, the count by severity, and the average days to resolve. There is no yearly reminder: incidents are logged when they happen.
- **Daily anomaly alerts** (`src/lib/security-alerts.ts`, run from `/api/cron/sweep-all`). Fixed, count-based rules over the last 24 hours of the audit log: 25 failed sign-ins, 8 against one account, 10 password-reset requests, any role change, 5 deletions, 10 flagged AI requests. The platform owner gets one in-app (and, by preference, email) notice a day at most. It sends counts only, never addresses. It does not block anything or learn a baseline.
- **AI guard and usage log** (`src/lib/ai-guard.ts`, wrapped around `chatJSON` and `streamChat`). Inputs are checked for common prompt-injection phrases. A hit is logged (`AI_INPUT_FLAGGED`) and the model is told to treat the text as material, not instructions; it is never blocked, because real manuscripts can quote these phrases. Replies are checked for secret-looking strings and for repeating the instructions, and flagged (`AI_OUTPUT_FLAGGED`). Each call writes one `AI_CALL` entry with provider, model, timing and sizes. **The text of questions and answers is not in this log.** The pattern list covers common wording only; it is a safety net, not a guarantee.
- **Model checksums** (`models.lock.json`, `src/lib/model-integrity.ts`, `scripts/pin-models.ts`, `scripts/verify-models.ts`). The lock file ships empty: no model is pinned yet, and nothing here invents a hash. After the embedding model first downloads on a machine you trust, run `bun scripts/pin-models.ts Xenova/all-MiniLM-L6-v2 <folder with the model files> <revision note>` and commit the lock file. From then on, the embedding model is used only if its files match; otherwise the platform falls back to the built-in hashed vectors and logs why. The speech models are not covered yet.
- **Still needs you (not code):** separate preview and production databases (a Vercel and database dashboard change); the first real restore drill and incident walk-through; a paid penetration test.
