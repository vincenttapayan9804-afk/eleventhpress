# Eleventh Research Lab — Tier 1 (credibility & resilience)

Closes the three highest-leverage gaps identified in the competitive
benchmark against unicorn research-AI tools (Scite.ai, Elicit, Consensus)
and enterprise edtech platforms: unverifiable AI claims, a "PRISMA" tool
that wasn't actually PRISMA, and a transcription pipeline with no recovery
path. No new Prisma models — everything here extends the existing
`ResearchLabDocument`/`TranscriptionJob` JSON payloads and job-runner
pattern.

## 1. Quote-verified matrix extraction (Gap Finder + Systematic Review)

Every one of the nine literature-review-matrix fields (research design,
participants, population, locale, theoretical framework, methodology, key
findings, conclusions, recommendations) now carries a `{value, quote,
verified}` shape instead of a plain string. The LLM is asked for a short
verbatim quote from the source's own excerpt proving each value; the
server then checks — deterministically, via a normalized substring match
in `verifyQuote()` (`src/lib/research-gap-finder.ts`) — whether that quote
actually appears in the source text. A quote under 12 characters is
treated as unverifiable rather than trivially "found."

This is the same "don't just trust the citation, check it" posture
Scite.ai built its product around, applied to matrix-field extraction
instead of citation classification. The UI renders a green shield for a
verified field and an amber shield with a tooltip for an unverified one;
the PRISMA draft's markdown table renders the same signal as a trailing
✓/⚠️ so it survives being copied out of the platform. Nothing here changes
the model call's cost-first LLM selection or the "llm or unavailable,
never fabricated" contract — verification is a check on top of that
contract, not a replacement for it.

## 2. Real PRISMA methodology (`src/lib/prisma-draft.ts`)

Previously the "PRISMA Drafting Tool" only borrowed PRISMA's section
names — the prompt itself told the model to note that a search strategy
and eligibility criteria "still need to be written by hand." That's now
true PRISMA-shaped input/output:

- **Eligibility criteria** and **search strategy** are free-text fields
  the researcher fills in themselves — never LLM-generated, since this
  platform has no way to know what search a researcher actually ran.
- **Candidates excluded at screening** — a `{label, reason}` list the
  researcher records by hand for sources that were considered but
  rejected before inclusion.
- **PRISMA flow diagram** — `recordsIdentified` / `recordsExcludedAtScreening`
  / `reportsSoughtForRetrieval` / `reportsNotRetrieved` / `studiesIncluded`
  computed deterministically from the actual included studies, excluded
  candidates, and sources that failed to fetch — never estimated or
  LLM-generated.
- **Screening log** — one row per candidate source (included / excluded at
  screening / not retrieved) with its reason, giving the draft a
  reproducible audit trail instead of just a narrative.

The draft now opens with `## Eligibility Criteria`, `## Search Strategy`,
`## PRISMA Flow Diagram`, and `## Screening Log` before the existing
Rationale/Literature Matrix/Synthesis/Limitations/Discussion/References
sections.

## 3. Transcription resilience (`src/lib/transcription.ts`)

- **`GET /api/cron/transcription-sweep`** — wires the existing (previously
  orphaned) `sweepStuckTranscriptionJobs()` into an actual route, mirroring
  `/api/cron/alt-text-sweep`/`/api/cron/book-sweep` exactly: fail-closed on
  `CRON_SECRET`, deliberately unregistered in `vercel.json` for now
  pending confirmed Hobby-tier cron-count headroom, same accepted
  platform-wide pattern as every other sweep route in this codebase.
- **`POST /api/research-lab/transcription/[id]/retry`** — owner-scoped
  (not admin-only, unlike the platform's other job-retry routes:
  transcription jobs are personal research artifacts, so only the
  uploader has standing to retry one). Re-runs a `FAILED` job against its
  already-stored audio without requiring a re-upload; rejects retrying a
  job that isn't currently `FAILED` with a 400.
- **UI**: a Retry button on failed jobs, and Copy/Download-as-.txt on
  completed ones — closing the "no export at all" gap the audit flagged.

## Explicit non-goals (Tier 1)

- No MP3/M4A/OGG transcoding or multi-language Whisper model — that's
  scoped for a later tier alongside speaker diarization/timestamps.
- No in-app editing/versioning of generated matrix cells, gaps, or drafts,
  and no history UI for the existing `GET` endpoints — Tier 2.
- No DOCX/PDF/LaTeX export or "send to manuscript draft" — Tier 2.
- No team workspaces, real-time collaboration, or institutional
  governance/audit dashboards — Tier 3.
- The synchronous-within-request execution model for both Gap
  Finder/PRISMA (LLM calls) and Transcription (local Whisper) is
  unchanged — this mirrors the platform-wide accepted pattern (see
  `/api/galley/generate`) of "run synchronously, recover via a cron sweep
  if the invocation dies mid-run," not a gap unique to Research Lab.
