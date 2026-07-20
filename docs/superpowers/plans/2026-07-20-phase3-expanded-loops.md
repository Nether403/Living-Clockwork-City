# Phase 3 — Expanded Loops Implementation Plan (Slice A)

**Date:** 2026-07-20  
**Spec:** [2026-07-20-phase3-expanded-loops-design.md](../specs/2026-07-20-phase3-expanded-loops-design.md)

## Tasks

1. Extend `types.ts`: `water`/`waste` resources, `reservoir`/`dump` nodes, `pipe` edges, `thirsty`/`clogged` flags, stock fields.
2. Extend `graph.ts` with `shortestPipePath`; generalize path helpers used by economy.
3. Economy: produce water, consume water at bakery dispatch, produce waste on food consume, dump sink, clogged labor block.
4. Tokens: deliver water/waste into stock piles.
5. `loadDistrict` Zod schemas for new kinds/fields.
6. Update `starter.json` with reservoir, dump, pipes, dump roads; extend all stock objects.
7. Caption predicates: `thirsty`, `clogged`, `any_home_clogged`.
8. Scenarios `dry_bakery` + `waste_backup`; update index + content tests.
9. Web: NODE_STYLES, EDGE_DIMENSIONS, token meshes, inspect stock, FlowArrows for reservoir/pipe, cascade pulse.
10. Verify `npm test` + `npm run build`.
