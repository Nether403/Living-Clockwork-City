# AGENTS.md — Living Clockwork City

Guidance for AI agents and human contributors working in this repo.

## Product north star

You are building a **miniature clockwork city**, not a spreadsheet city-builder with a 3D skin. Every resource should be a **visible token**. The signature moment is demolishing one piece and watching a readable cascade.

Read before changing behavior:

1. [ROADMAP.md](ROADMAP.md) — phases and finish lines
2. [docs/prd/living-clockwork-city.md](docs/prd/living-clockwork-city.md) — vision and non-goals
3. Active phase design under `docs/superpowers/specs/`
4. Active implementation plan under `docs/superpowers/plans/`

## Architecture hard rules

1. **`packages/sim` is pure.** No `three`, no DOM, no `window`, no wall-clock `Date.now()` for sim logic. Tests must run headless via Vitest.
2. **Presentation never writes sim state.** `apps/web` reads `FrameSnapshot` and sends commands (`tick`, `demolish`, `restore`, later place/repair).
3. **Fixed tick model.** Game time advances in discrete ticks (Phase 1: 250ms at 1×). Wall clock only decides how often ticks are requested.
4. **YAGNI against SimCity.** Do not add freeform building, procedural megacities, multiplayer, or rigid-body physics unless the roadmap phase explicitly calls for it.

## Monorepo layout

```
apps/web/           # Vite + Three.js UI
packages/sim/       # Simulation kernel
content/districts/  # Authored JSON maps
content/scenarios/  # Authored scenario presets (Phase 2+)
docs/prd/           # Product requirements
docs/superpowers/   # Specs + implementation plans
```

## Commands

```bash
npm install
npm test              # @lcc/sim Vitest
npm run build         # sim + web
npm run dev           # web diorama
```

## Working style

- Prefer small focused files with one responsibility.
- Follow TDD for sim changes; scenario tests should assert cascade predicates.
- Keep user-facing copy consistent with the PRD / roadmap wording.
- When a decision diverges from a spec, note it in the commit message.
- Do not expand into the next roadmap phase mid-PR. Finish the active phase’s acceptance checklist first.

## Current focus

See [ROADMAP.md](ROADMAP.md). Implement the **in progress** phase only unless the user explicitly asks otherwise.

## Phase checklist (quick)

| Phase | Ship cue |
|-------|----------|
| 1 ✅ | Demolish demo with 3 stories |
| 2 ✅ | Scenario menu + readable cascades |
| 3 🔄 | Water / waste / housing / congestion |
| 4 | Limited builder = “game finished” |
| 5 | Multi-district craft = “product finished” |
