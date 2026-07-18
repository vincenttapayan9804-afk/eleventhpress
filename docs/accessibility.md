# Accessibility

The user-facing statement lives at Policies → Accessibility statement
(`src/components/views/accessibility-view.tsx`). This is the maintainer-facing
detail behind it.

## Automated scanning

`tests/a11y.spec.ts` runs an axe-core scan (via `@axe-core/playwright`)
against WCAG 2A/2AA/2.2AA rules, wired into CI as the `a11y` job in
`.github/workflows/ci.yml`. It's scoped to `/` only: most of this app has
no distinct URL per view (see `src/app/sitemap.ts`'s comment — the whole
SPA lives under one address, switched via zustand state), and the other
real routes (`/article/[id]`, etc.) need database rows CI's Postgres
doesn't have (no schema push or seed there — see `ci.yml`) to render
anything other than an empty/error state.

Run locally: `bun run test:a11y` (needs a Chromium binary — either let
Playwright manage its own, or set `PLAYWRIGHT_CHROMIUM_PATH` to a
pre-installed one).

## Why it's informational, not blocking

The current scan reports 8 `color-contrast` violations, all against the
hero section's gradient background. This is a known, documented axe-core
limitation: it can't composite CSS gradients/background-images/
`backdrop-filter` and falls back to comparing foreground text against the
page's flat `--background` token instead of the real rendered backdrop —
not the actual color the pixel renders against. A rendered-page screenshot
of the hero (white/light text on a dark navy-to-purple gradient with a
world-map graphic) confirms real contrast is fine; axe is comparing white
text against a *different*, near-white element it mis-resolved as the
background.

One violation from this same run *was* real and got fixed alongside this
change: the footer's "Admin Portal" link used `text-muted-foreground/60`
(an extra 60% opacity on top of an already-reduced-contrast token) —
unlike the hero cases, the footer isn't a gradient/glass surface axe would
mis-resolve, so this one was a genuine, if borderline, contrast reduction
on an interactive control. Fixed by dropping the `/60`.

Because telling a real violation apart from this false-positive class
currently takes a human visual check (a screenshot, in practice), the CI
job stays `continue-on-error: true` — the same posture this repo already
uses for new checks with an untriaged backlog (see semgrep in
`security.yml`, and type-check/lint/test in `ci.yml`). If the hero
section's background ever changes to something axe can correctly
composite (a flat color, or an `<img>` instead of a CSS gradient), revisit
whether it's clean enough to make blocking.

## Known structural gap

There's no authoring tool enforcing heading hierarchy, alt-text-on-insert,
or semantic structure at submission time — manuscripts go through a plain
`<Textarea>` (see the ATAG-focused phase of the broader accessibility
epic this belongs to, not yet built). Whatever HTML ends up in a
published galley depends on the upstream conversion step, which this
scan doesn't cover.
