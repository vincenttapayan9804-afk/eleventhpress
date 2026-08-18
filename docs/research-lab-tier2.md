# Eleventh Research Lab — Tier 2 (ownership & interoperability)

Tier 1 made the Research Lab's AI output trustworthy (quote-verified claims,
real PRISMA methodology, transcription recovery). Tier 2 makes that output
*yours*: editable in place, exportable in the formats reference managers and
document editors actually import, browsable as history instead of vanishing
after one page refresh, and — for transcription — citable down to the
second instead of only as a flat wall of text.

No new infrastructure: everything here extends the existing
`ResearchLabDocument`/`TranscriptionJob` tables and the same "llm or
unavailable, never fabricated" contract from Tier 1 — editing and exporting
only ever operate on a document that was already a real, saved AI output.

## 1. In-app editing, with the original preserved

A researcher can now revise a Gap Finder's overview/gaps or a PRISMA
draft's full markdown directly in the dashboard and save it —
`PATCH /api/research-lab/gap-analysis/[id]` and
`PATCH /api/research-lab/prisma-draft/[id]`, both owner-scoped. The first
edit copies the untouched AI output into a new `originalResultJson` column
before applying the change; every edit after that only updates the current
version, so the pristine AI-generated draft is never lost even after
several rounds of hand-editing — no second LLM call needed to "see the
original," and no full version-history log to maintain (a deliberately
lighter mechanism than full versioning: current vs. original, not every
intermediate step).

## 2. Export suite (`src/lib/research-lab-export.ts`)

`GET /api/research-lab/export/[id]?format=md|pdf|bibtex|ris`, owner-scoped,
covers both tools:

- **Markdown** — the PRISMA draft's own markdown, or the Gap Finder's
  overview/gaps assembled into the same shape, ready to paste into any
  editor.
- **PDF** — a plain, legible PDFKit render (title, generation metadata,
  body text) — a working draft to print or attach, deliberately not styled
  like the platform's branded certificates.
- **BibTeX / RIS** — a real bibliography of every source the run drew on.
  Internal sources are re-resolved against the actual `Article` record (the
  same builder the article page's own Cite panel uses — full author list,
  journal, ISSN, DOI). External sources use whatever metadata the
  researcher or the discovery search actually supplied at generation time,
  captured in a new `buildBibTeXExternal`/`buildRisExternal` pair in
  `citation-export.ts` — an honest `@misc`/`ELEC`-type entry, not a padded
  imitation of a full journal-article record.

## 3. History surfaced in the dashboard

The `GET` history endpoints from Tier 1 existed but were never wired into
the UI. Both the Gap Finder and PRISMA panels now have a History button
that lists the researcher's last 10 saved runs (title, relative timestamp,
an "edited" badge) — clicking one loads it back into the panel with the
same edit/export controls a fresh run gets.

## 4. Timestamp-linked transcript citations

`runTranscriptionJob` now asks Whisper for `return_timestamps: true` and
stores the model's own chunk-level `{text, start, end}` output as
`TranscriptionJob.segmentsJson` — real model output, never estimated or
interpolated. The transcription panel renders one row per chunk with its
own `MM:SS` offset and a one-click "copy as timestamped citation" button
(`"quote..." (filename.wav @ 04:12)`), closing the "flat wall of text with
no way to attribute a quote" gap the original benchmark flagged. Jobs
transcribed before this shipped simply have `segmentsJson: null` and fall
back to the plain transcript view — no backfill needed.

## Explicit non-goals (Tier 2)

- No full version-history log (every intermediate edit kept) — current vs.
  original only, per the reasoning in §1.
- No DOCX export — Markdown/PDF/BibTeX/RIS cover the reference-manager and
  document-editor interoperability this tier targeted; DOCX would need a
  new dependency for marginal benefit over Markdown-into-Word's own native
  import.
- No speaker diarization — a separate, heavier model from the
  `whisper-tiny.en` ASR pipeline already in use; deferred alongside
  multi-language/MP3 support (still Tier-1's stated non-goal).
- No team workspaces, real-time collaboration, or institutional governance/
  audit dashboards — Tier 3.
