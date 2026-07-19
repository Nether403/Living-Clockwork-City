# Living Clockwork City — Design Spec

**Date:** 2026-07-19  
**Status:** Draft for implementation planning  
**Related PRD:** `docs/prd/living-clockwork-city.md`

## 1. Problem

City sims usually hide the economy in numbers. This game wants the opposite: the economy must be *things you can see move*. The core delight is poking the machine — remove one critical piece and watch the failure cascade through physical space.

## 2. Scope Decomposition

This product is too large for a single implementation plan. It decomposes into sequential sub-projects:

| Phase | Name | Outcome |
|-------|------|---------|
| **1** | Sim Kernel + Demolish Demo | Headless graph sim + 3D diorama where demolishing one node causes a readable cascade |
| **2** | Readability & Scenario Pack | Better visual language, 5 authored “what if” scenarios, inspect tooltips |
| **3** | Expanded Loops | Water, waste, housing capacity, transit congestion |
| **4** | Limited Builder | Place/repair a small set of pieces (still not a freeform tycoon) |
| **5** | Content Pipeline | Map editor, balance tools, more districts |

**This design + the accompanying plan cover Phase 1 only.** Later phases get their own specs.

## 3. Approaches Considered

### A. Full continuous physics (Unity/Unreal rigid bodies + conveyors)

- **Pros:** Maximum “physical” authenticity.
- **Cons:** Hard to balance, expensive to simulate at city scale, weak testability, long content pipeline.
- **Verdict:** Rejected for v1.

### B. Discrete token agents on a city graph (recommended)

- **Pros:** Matches the fantasy (visible carts/batteries/workers), deterministic, headless-testable, scales to a miniature district, easy to express demolish = remove edge/node.
- **Cons:** Not “true” physics; motion is choreographed along paths.
- **Verdict:** **Chosen.** Tokens are physical *enough* because they occupy space, take travel time, queue at bottlenecks, and pile up when blocked.

### C. Spreadsheet sim + particle cosmetics

- **Pros:** Fast to code.
- **Cons:** Breaks the product promise the moment the player notices VFX are decorative.
- **Verdict:** Rejected.

## 4. Phase 1 Design

### 4.1 Player experience

On load, the player sees a small tabletop district (~20–40 nodes): homes, bakery, farm, market, power plant, substations, workplaces, and a road/power graph connecting them.

Visible tokens continuously move:

- **Bread crates** farm → bakery → market → homes
- **Energy cells** plant → substations → powered buildings
- **Workers** homes → workplaces (and back on a shift timer)

The player can:

1. Orbit / zoom the diorama.
2. Hover a node or edge to see its name and short status (“Bakery: 3 crates waiting, powered”).
3. Click **Demolish** on a selected road, bridge, bakery, or power plant.
4. Watch queues form, consumers starve/darken, workers idle.
5. Click **Restore** to put the piece back and resume flow.

No win/lose screen in Phase 1 — the toy *is* the product.

### 4.2 Simulation architecture

```
┌─────────────────────────────────────────────┐
│                 GameApp (UI)                │
│  input → camera → selection → demolish UI   │
└───────────────────┬─────────────────────────┘
                    │ commands / events
┌───────────────────▼─────────────────────────┐
│              Presentation (Three.js)        │
│  node/edge meshes, token meshes, anim lerp  │
└───────────────────┬─────────────────────────┘
                    │ read-only frame snapshot
┌───────────────────▼─────────────────────────┐
│              Simulation Kernel              │
│  CityGraph · Stockpiles · TokenAgents · Tick│
└─────────────────────────────────────────────┘
```

**Hard rule:** Presentation never writes sim state. Sim never imports Three.js.

### 4.3 City graph model

- **Node:** building or junction. Fields: `id`, `kind`, `capacity`, `stock` map, `powered` bool, `operational` bool.
- **Edge:** road or power line. Fields: `id`, `from`, `to`, `kind` (`road` | `power`), `traversalTicks`, `capacity` (max tokens in flight / concurrent).
- **Token:** mobile resource unit. Fields: `id`, `resource` (`food` | `energy` | `labor`), `location` (node id or edge id + progress), `destination`, `state` (`moving` | `queued` | `delivered` | `stranded`).

Demolish removes a node or edge from the graph:

- Tokens on a removed edge become `stranded` (visually spill / stop).
- Producers downstream lose inputs; consumers tick down buffered stock.
- Power edges/nodes darken dependent buildings when connectivity to a plant is lost.

### 4.4 Tick model

Fixed-step simulation (`tick` = 250ms wall clock at 1× speed).

Each tick:

1. **Production:** operational producers emit tokens into output stock if inputs + power satisfied.
2. **Dispatch:** nodes with surplus create tokens onto outbound edges toward demand sinks (greedy nearest-demand for MVP).
3. **Transit:** tokens advance along edges; respect edge capacity (extras wait in node queue).
4. **Delivery:** arriving tokens increment destination stock; labor tokens assign workers.
5. **Consumption:** homes/workplaces consume food/energy buffers; if empty, mark `starving` / `unpowered` / `idle`.
6. **Cascade flags:** update derived status for presentation (glow off, queue length, idle worker count).

Determinism: given the same map + seed + demolish timeline, tick N is reproducible.

### 4.5 Starter district (authored content)

File: `content/districts/starter.json`

Minimum topology for three distinct demolish stories:

1. **Cut the farm road** → bakery starves → markets empty → homes go hungry; workers still commute until food buffers die.
2. **Demolish the power plant** → substations dark → bakery stops → food chain freezes even though roads remain.
3. **Remove the river bridge** → one residential cluster cut off from workplaces → idle workers pile on one side; opposite workplaces empty.

### 4.6 Presentation rules

- Tokens are chunky, readable meshes (crate / battery / person), not particles.
- Queues stack visibly at node pads.
- Unpowered buildings dim; starving homes show empty pantry cue (simple icon mesh, not floating UI spam).
- Demolished pieces play a short collapse/remove animation, then leave a rubble/gap marker so the missing link stays obvious.
- Avoid HUD number walls. One inspect panel max.

### 4.7 Error / edge handling

- Demolishing the last power plant is allowed (city goes dark — that’s the point).
- Demolishing under a moving token strands it; restore does **not** resurrect stranded tokens (keeps cause/effect honest). New production fills the gap after restore.
- Pause when tab hidden; sim clock uses tick count, not wall `Date.now()` drift.

## 5. Tech Stack (Phase 1)

| Layer | Choice |
|-------|--------|
| Language | TypeScript (strict) |
| Bundler | Vite |
| 3D | Three.js |
| Tests | Vitest (headless sim) |
| Content | JSON district files + Zod schema validation |
| Lint/format | ESLint + Prettier (minimal setup) |

## 6. Package Layout

```
apps/web/                  # Vite app, Three.js scene, UI
packages/sim/              # Pure TS simulation kernel
content/districts/         # Authored maps
docs/prd/                  # Product requirements
docs/superpowers/specs/    # Design specs
docs/superpowers/plans/    # Implementation plans
```

Monorepo via npm workspaces (lightweight; no Nx/Turborepo required in Phase 1).

## 7. Testing Strategy

- **Unit:** graph connectivity, power propagation, token dispatch, consumption, demolish/restore invariants.
- **Scenario tests:** scripted demolish at tick T → assert status predicates at tick T+N (e.g., `homes.east.starving === true`).
- **Manual:** browser checklist for the three demolish stories and orbit controls.

## 8. Out of Scope for Phase 1

- Water / waste / construction loops
- Freeform building placement
- Save games beyond URL seed + demolish log (optional stretch)
- Mobile-specific UI polish
- Multiplayer
- Audio design beyond a single ambient bed (optional)

## 9. Open Decisions (locked defaults)

| Question | Default for Phase 1 |
|----------|---------------------|
| Engine | Three.js web, not Godot/Unity |
| Sim paradigm | Discrete tokens on graph |
| Economy depth | Food + Energy + Labor |
| Content | One starter district |
| Win condition | None (toy / sandbox) |
| Networking | None |

## 10. Acceptance Checklist (Phase 1 Done)

- [ ] `packages/sim` runs Vitest suite green with demolish scenario coverage
- [ ] Browser demo loads starter district with moving food/energy/labor tokens
- [ ] Player can demolish and restore road / bakery / power plant / bridge
- [ ] Three authored demolish stories produce visually distinct cascades
- [ ] README explains how to install, test, and run the demo
