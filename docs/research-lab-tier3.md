# Eleventh Research Lab — Tier 3

Tier 1 made the Gap Finder and PRISMA drafting tool genuinely trustworthy
(quote-verified matrices, real PRISMA methodology, resilient transcription).
Tier 2 made a saved run a real working artifact (in-app editing with a
preserved original, a Markdown/PDF/BibTeX/RIS export suite, history in the
dashboard, timestamp-linked transcript citations). Tier 3 connects the tool
to the researcher's wider workflow: working with a collaborator, bringing in
citations from a reference manager, chaining the two tools together on one
investigation, and giving editorial staff a real picture of how the tool is
used across the platform.

## 1. Team workspace sharing

A saved `ResearchLabDocument` can be shared with one or more collaborators
by their platform account email (`ResearchLabDocumentShare`, unique per
`[documentId, sharedWithUserId]`). Sharing is deliberately **read-only**:
a collaborator can view the document (in the History panel's new "Shared
with me" section) and use every export format, but PATCH edit routes
remain owner-only everywhere they're checked. There is no real-time
co-editing and no conflict-resolution story for two people editing
`originalResultJson` at once — building that honestly would need a
different data model (operational transforms or CRDTs) than a
single-writer `resultJson` column supports, so this stays a genuine
"grant read access" primitive rather than a fake "real-time collaboration"
label on top of last-write-wins.

Owner-only management lives at `/api/research-lab/documents/[id]/share`
(GET list / POST add-by-email / DELETE remove); a share only succeeds
against an email with a real account on this platform — it never queues an
invite to an address that doesn't exist yet.

## 2. Reference-manager interop (BibTeX import)

The inverse of Tier 2's BibTeX export: `src/lib/citation-import.ts` parses
a pasted `.bib` file (the format every major reference manager — Zotero,
Mendeley, EndNote — exports) into external-source entries, wired into both
tools' external-source picker as an "Import BibTeX" button. Only entries
that carry a real `url` or `doi` field are imported — an external source
needs a live URL for this platform to actually fetch and read it, so an
entry with neither is reported as skipped, never silently dropped or given
a fabricated URL.

## 3. Cross-tool chaining

A finished Gap Finder run now offers "Draft PRISMA review from this" —
carries the same internal/external sources and a plain-text summary of the
identified gaps into the Systematic Review tool's search-strategy field,
switching tabs automatically. This closes a real workflow gap: a
researcher who just identified gaps in the literature commonly wants to
scope a systematic review around exactly those sources next, and
previously had to re-search and re-add every source by hand.

## 4. Institutional governance dashboard

`/api/admin/research-lab-activity` (SUPER_ADMIN/EDITOR/ASSOCIATE_EDITOR)
surfaces real, aggregated usage of the Research Lab: document counts by
kind, transcription job counts by status, how many documents have been
edited since generation, how many active shares exist, the most active
researchers, and a feed of recent activity — every number a live
`count`/`groupBy` against `ResearchLabDocument`/`TranscriptionJob`/
`AuditLog`, never an estimate. Document/edit/share actions now write
`AuditLog` rows (`RESEARCH_LAB_DOCUMENT_CREATED` / `_EDITED` / `_SHARED`)
so this dashboard has real data to show. It's an oversight surface for
"how is this tool actually being used platform-wide," not a way to read
into an individual researcher's own unshared drafts — those stay
owner/share-scoped everywhere else in the tool.

## Explicit non-goals (Tier 3)

- **No real-time co-editing.** Sharing is view-only; see §1.
- **No org-wide default sharing / department-scoped visibility.** Sharing
  is always an explicit, one-document-at-a-time grant by the owner.
- **No import formats beyond BibTeX** (no RIS/EndNote-XML import) — BibTeX
  is what this platform's own export suite already produces and what the
  major reference managers export by default; adding more formats without
  a concrete request would be speculative.
- **No notification/email on share** — the collaborator sees the shared
  document the next time they open the Research Lab dashboard; there's no
  transactional email pipeline wired to this yet.
