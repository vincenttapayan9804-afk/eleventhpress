# Dashboard Sidebar — Grouped Navigation

The dashboard sidebar (`src/components/views/dashboard-view.tsx`) organizes
its (currently 33) tabs into 9 labeled sections instead of one flat list.
This is a presentational change only — every tab keeps its exact
pre-existing `roles` gate on `TABS`, so no one's visibility into any
feature changed; a SUPER_ADMIN still sees everything, a READER still sees
only their own handful of tabs. What changed is how those tabs are
organized once visible.

## The 9 groups

1. **Home** — Overview, Profile, Professional Dashboard (EXPERT-only
   variant of Overview).
2. **Publishing — My Work** — everything an individual does to produce
   their own scholarly output: New submission, My articles, My books,
   Article distribution, My reviews, Certificates, and the Eleventh
   Research Lab's authoring tools (gap analysis, PRISMA draft,
   transcription).
3. **Account & Access** — Billing & invoices, Subscription, Role
   application.
4. **Research Compliance** — self-service regulatory/funding disclosures:
   Ethics & COI, My grants. Kept separate from "My Work" because it's
   about compliance obligations, not manuscript production.
5. **Editorial Operations** — Editorial queue, Indexing & discovery, Book
   acquisitions, Research integrity (Retraction Watch sync).
6. **Content Channels** — Magazines, Podcasts, Media (News/Blog),
   Narration — the same multi-format publishing job repeated per channel.
7. **Analytics & Reporting** — read-only measurement tools: COUNTER 5 /
   SUSHI, Institutions (COUNTER API keys / IP-based institutional access —
   not org-structure admin, despite the name), Research dashboard
   (department comparison, Phase 5), Institutional rankings (Phase 5).
8. **Institution Administration** — tenant-scoped record management:
   Departments, Ethics review (admin queue), Grants (admin registry).
9. **Platform Administration** — SUPER_ADMIN-only: Branding, Tenants,
   Admin & audit.

## Implementation notes

- Each `TABS` entry gained a `group: string` field; the array itself was
  reordered so tabs sharing a group sit contiguously (rendering order
  drives the section-header placement — there's no separate grouping
  data structure to keep in sync).
- Section headers render only at `lg` and above (`hidden ... lg:block`).
  Below `lg` the sidebar is unchanged from before this change: a flat,
  horizontally-scrolling row of buttons. Inline group labels would break
  that scroll rhythm rather than help it on a narrow screen, so mobile/
  tablet intentionally keeps the flat list.
- No new components, no new state — `visibleTabs.map` now also tracks
  whether the previous item's `group` differs from the current one, and
  renders a `<p>` label immediately before the first button of each new
  group.
