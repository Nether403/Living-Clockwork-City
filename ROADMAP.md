# Living Clockwork City — Roadmap

A miniature 3D city where the economy is visible token flow. The finished game is a **tabletop machine you poke, break, and gently repair** — not SimCity with particles.

## Finish lines

| Milestone | After phase | Meaning |
|-----------|-------------|---------|
| **Demo / portfolio** | Phase 2 | Five scenarios; strangers can narrate cascades |
| **Game** | Phase 4 | Constrained repair/place loop under stress |
| **Crafted product** | Phase 5 | Multiple districts, polish, shareable scenarios |

Do **not** wait for procedural megacities, multiplayer, or freeform building. Those fight the fantasy.

## Phases

### Phase 1 — Sim kernel + demolish demo ✅

**Status:** Complete

Headless discrete-token sim (food, energy, labor) + Three.js diorama. Demolish/restore one piece; three authored cascade stories on the starter district.

### Phase 2 — Readability & scenario pack

**Status:** Complete

Make the toy *communicative*:

- Ghost flow arrows on hover / selection
- Stronger cascade telegraphing (queues, dimming, stranded cues)
- Scenario menu with 5 authored “what if” presets
- Slow-mo (finer than current speed steps)
- After-action caption when a cascade becomes readable
- Richer inspect tooltips (including demolished payloads)

**Done when:** A new player can run five scenarios and explain what happened without reading numbers.

### Phase 3 — Expanded loops

Water, waste, housing capacity, transit congestion. Construction materials appear as visible tokens when building/repairing (feeds Phase 4).

**Done when:** Cascades involve closed loops (e.g. waste backup blocks homes; water cut stops bakery even with food/power).

### Phase 4 — Limited builder

Palette of ~5–8 pieces (road, pipe, substation, depot, repair kit). Goal: stabilize or recover a stressed district — not freeform city-building.

**Done when:** Observation becomes play: recover a failing scenario with a constrained palette. **This is the complete playable game.**

### Phase 5 — Districts & craft

3–5 authored districts, light map/balance tools, polish (audio bed, camera presets, shareable scenario links).

**Done when:** The product feels intentional and hand-made. **This is the crafted ship.**

## Out of scope (unless Phase 5 still feels thin)

- Competitive multiplayer
- Procedural megacities
- Full freeform tycoon construction
- Combat / RPG campaign
- Continuous rigid-body physics as the sim backbone

## Related docs

- [Product requirements](docs/prd/living-clockwork-city.md)
- [Phase 1 design](docs/superpowers/specs/2026-07-19-living-clockwork-city-design.md)
- [Phase 2 design](docs/superpowers/specs/2026-07-20-phase2-readability-design.md)
- [AGENTS.md](AGENTS.md) — guidance for AI/human contributors
