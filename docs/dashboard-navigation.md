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

- `TABS` lives in `src/components/dashboard/dashboard-tabs.ts` (with
  `tabsForRole`), shared by the dashboard and the ⌘K command palette. Each
  entry has a `group`; tabs sharing a group sit contiguously, and
  rendering order drives where section headers appear.
- `src/components/dashboard/dashboard-nav.tsx` renders the navigation:
  - **Wide screens (`lg`+):** the grouped sidebar. Any section can be
    pinned from its hover pin icon; pinned sections (up to 6, saved per
    user on the device) appear in a "Pinned" group at the top.
  - **Phones and tablets:** a bar showing the current section plus up to
    three pinned shortcuts. "All sections" opens a bottom sheet with a
    search box and the grouped list — replacing the old sideways-scrolling
    row of every tab.
- The overview opens with "Needs your attention" (`attention-panel.tsx`:
  the role's pending work, built from the dashboard data) and a first-run
  "Get set up" checklist (`onboarding-checklist.tsx`), which disappears
  once complete or dismissed.
