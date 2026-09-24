# Accessibility

The user-facing statement lives at Policies → Accessibility statement
(`src/components/views/accessibility-view.tsx`). This is the maintainer-facing
detail behind it.

## Automated scanning

`tests/a11y.spec.ts` runs an axe-core scan (via `@axe-core/playwright`)
against WCAG 2A/2AA/2.2AA rules, wired into CI as the (blocking) `a11y`
job in `.github/workflows/ci.yml`. It covers every static, database-free
public view — Home, About, FAQs, Policies, Privacy, Terms, and the
Accessibility statement itself — reached from `/` via in-page navigation
(client-side view switches, since the whole SPA lives under one address —
see `src/app/sitemap.ts`'s comment). The other real routes (`/article/[id]`,
dashboard tabs, etc.) still aren't covered: they need database rows CI's
Postgres doesn't have (no schema push or seed there — see `ci.yml`) to
render anything other than an empty/error state.

Run locally: `bun run test:a11y` (needs a Chromium binary — either let
Playwright manage its own, or set `PLAYWRIGHT_CHROMIUM_PATH` to a
pre-installed one).

## The gradient false positive, and why the job can be blocking anyway

An earlier scan reported 8 `color-contrast` violations, all against the
home hero section's gradient background. This is a known, documented
axe-core limitation: it can't composite CSS gradients/background-images/
`backdrop-filter` and falls back to comparing foreground text against the
page's flat `--background` token instead of the real rendered backdrop —
not the actual color the pixel renders against. A rendered-page screenshot
of the hero (white/light text on a dark navy-to-purple gradient with a
world-map graphic) confirmed real contrast is fine; axe was comparing
white text against a *different*, near-white element it mis-resolved as
the background.

One violation from that same run *was* real and got fixed alongside it:
the footer's "Admin Portal" link used `text-muted-foreground/60` (an extra
60% opacity on top of an already-reduced-contrast token) — unlike the hero
case, the footer isn't a gradient/glass surface axe would mis-resolve, so
this one was a genuine, if borderline, contrast reduction on an
interactive control. Fixed by dropping the `/60`.

Rather than leave the whole job informational because of one known false
positive, the hero section carries `data-testid="hero-gradient-section"`
(`src/components/views/home-view.tsx`) and `tests/a11y.spec.ts` excludes
exactly that region with axe's `.exclude()` — scoped to the one DOM
subtree axe can't correctly evaluate, not a rule-wide `disableRules()`. A
genuine color-contrast violation anywhere else on any scanned view,
including elsewhere on the home page, still fails the build. If the hero
section's background ever changes to something axe can correctly
composite (a flat color, or an `<img>` instead of a CSS gradient), the
exclusion can come off entirely.

## Known structural gap

There's no authoring tool enforcing heading hierarchy, alt-text-on-insert,
or semantic structure at submission time — manuscripts go through a plain
`<Textarea>` (see the ATAG-focused phase of the broader accessibility
epic this belongs to, not yet built). Whatever HTML ends up in a
published galley depends on the upstream conversion step, which this
scan doesn't cover.
