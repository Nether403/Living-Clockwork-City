# Living Clockwork City

A miniature 3D city where the economy is physically simulated — bread crates, energy cells, and workers move through the streets. Remove one road, factory, bridge, or power station and watch the consequences spread.

## Concept

City sims usually hide the economy in numbers. Living Clockwork City does the opposite: food, energy, and labor are **tokens you can see move** along roads and power lines. Demolish one critical piece and the failure cascades through physical space — queues form, buildings dim, workers idle.

The core loop is a toy, not a win/lose game: poke the machine, watch the cascade, restore the piece, and see flow resume.

## Phase 1 scope

Phase 1 delivers a **headless discrete-token simulation** plus a **Three.js web diorama**:

- Starter district loaded from `content/districts/starter.json`
- Visible food, energy, and labor tokens moving on a city graph
- Click to select nodes/edges; inspect panel shows status and stock
- **Demolish** / **Restore** on roads, buildings, and power infrastructure
- Orbit camera, pause, and sim speed controls

| Doc | Purpose |
|-----|---------|
| [Product requirements](docs/prd/living-clockwork-city.md) | Vision, goals, loops, success criteria |
| [Design spec (Phase 1)](docs/superpowers/specs/2026-07-19-living-clockwork-city-design.md) | Architecture, sim model, tech stack |
| [Implementation plan (Phase 1)](docs/superpowers/plans/2026-07-19-living-clockwork-city-phase1.md) | Task-by-task build guide |
| [Roadmap](ROADMAP.md) | Phases, finish lines |
| [AGENTS.md](AGENTS.md) | Contributor / agent guidance |
| [Phase 2 design](docs/superpowers/specs/2026-07-20-phase2-readability-design.md) | Readability & scenarios |
| [Phase 2 plan](docs/superpowers/plans/2026-07-20-phase2-readability.md) | Task-by-task Phase 2 guide |

## Install

From the repo root:

```bash
npm install
```

Requires Node.js 18+ and npm (workspaces monorepo).

## Test

Run the headless simulation test suite (`@lcc/sim`, Vitest):

```bash
npm test
```

Target a single workspace:

```bash
npm run test -w @lcc/sim
```

## Run

Start the Vite dev server for the browser demo:

```bash
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173/`). Drag to orbit the diorama; click a road segment or building to select it.

**Controls**

| Input | Action |
|-------|--------|
| Click | Select node or edge |
| Drag | Orbit camera |
| **Space** | Pause / resume simulation |
| **[** | Slower (0.25× → 0.5× → 1× → 2×) |
| **]** | Faster (0.25× → 0.5× → 1× → 2×) |

Build production assets:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview -w @lcc/web
```

## Demolish scenarios to try

The starter district encodes three authored “what if” stories. Select the target, click **Demolish**, watch the cascade, then **Restore** to put it back.

### 1. Cut the farm road — `road_farm_bakery`

Select the road between the farm and bakery. After demolition, bread crates stop moving; the bakery starves, markets empty, and homes eventually go hungry. Workers may still commute until food buffers run out.

### 2. Demolish the power plant — `plant_a`

Select the power plant node. Substations go dark, the bakery stops producing (even though roads remain), and the food chain freezes from lack of power.

### 3. Remove the river bridge — `road_bridge`

Select the bridge road edge. One residential cluster loses access to workplaces on the other side — idle workers pile up on one bank while opposite workplaces sit empty.

## Repo layout

```
apps/web/                  # Vite + Three.js demo (GameApp, scene, UI)
packages/sim/              # Pure TypeScript simulation kernel (Vitest)
content/districts/         # Authored district JSON (starter.json)
docs/prd/                  # Product requirements
docs/superpowers/specs/    # Design specs
docs/superpowers/plans/    # Implementation plans
```

Root scripts delegate to workspaces: `npm test` → `@lcc/sim`, `npm run dev` → `@lcc/web`.

## Roadmap

See [ROADMAP.md](ROADMAP.md). **Phase 2 (readability & scenarios) is in progress.** Finish lines: demo after Phase 2, game after Phase 4, crafted product after Phase 5.
