# Living Clockwork City

A miniature 3D city where the economy is physically simulated — bread carts, batteries, and workers move through the streets. Remove one road, factory, bridge, or power station and watch the consequences spread.

## Status

**Phase 1 in progress.** Monorepo scaffold and `@lcc/sim` types are in place.

| Doc | Purpose |
|-----|---------|
| [Product requirements](docs/prd/living-clockwork-city.md) | Vision, goals, loops, success criteria |
| [Design spec (Phase 1)](docs/superpowers/specs/2026-07-19-living-clockwork-city-design.md) | Architecture, sim model, tech stack |
| [Implementation plan (Phase 1)](docs/superpowers/plans/2026-07-19-living-clockwork-city-phase1.md) | Task-by-task build guide |

## Development

```bash
npm install
npm run test          # run @lcc/sim tests
npm run test -w @lcc/sim
npm run build -w @lcc/sim
```

## Phase 1 in one sentence

Hand-authored web diorama (TypeScript + Three.js) with a headless discrete token simulation for food, energy, and labor — demolish a piece and watch the cascade.

## Later phases

2. Readability & scenario pack  
3. Water / waste / housing loops  
4. Limited builder  
5. Content pipeline / more districts
