# Phase 2 Readability & Scenario Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a scenario dock, ghost flow arrows, cascade pulses, slow-mo, after-action captions, and richer demolished inspect — so five authored scenarios are narratable by eye.

**Architecture:** Pure scenario/caption helpers in `@lcc/sim`; Vite app adds ScenarioMenu, CaptionBanner, FlowArrows overlay; GameApp orchestrates reset/warmup/auto-demolish without writing sim internals.

**Tech Stack:** Existing TypeScript monorepo, Vitest, Three.js, Zod

## Global Constraints

- Simulation code must not import `three` or DOM APIs.
- Presentation never writes sim state except via Simulation commands.
- Phase 2 does not add water/waste/builder systems.
- Scenario JSON lives in `content/scenarios/`.
- Keep UI compact — no dashboard of stats in the first viewport.

**Spec:** `docs/superpowers/specs/2026-07-20-phase2-readability-design.md`

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `packages/sim/src/scenario.ts` | Types, Zod load, caption evaluation, scenario session scheduling |
| `packages/sim/tests/scenario.test.ts` | Caption + session tests |
| `content/scenarios/*.json` | Five scenario files + optional index |
| `apps/web/src/ui/ScenarioMenu.ts` | Scenario dock UI |
| `apps/web/src/ui/CaptionBanner.ts` | After-action caption |
| `apps/web/src/scene/FlowArrows.ts` | Ghost arrows in Three.js |
| `apps/web/src/GameApp.ts` | Wire scenarios, slow-mo, pulses, captions |
| `apps/web/src/scene/CityScene.ts` | Pulse helpers; hook arrows |
| `apps/web/src/ui/InspectPanel.ts` | Demolished payload details |
| `README.md` / `ROADMAP.md` | Status updates |

---

### Task 1: Scenario types, loader, caption predicates

**Files:**
- Create: `packages/sim/src/scenario.ts`
- Create: `packages/sim/tests/scenario.test.ts`
- Modify: `packages/sim/src/index.ts`
- Modify: `packages/sim/src/types.ts` (only if FrameSnapshot needs demolished payloads — prefer extending snapshot in Simulation)

**Interfaces:**
- Produces: `ScenarioDef`, `loadScenario(json)`, `evaluateCaptions(snapshot, rules, fired): { id, text }[]`
- Also extend `FrameSnapshot` with `demolished: DemolishedRecord[]` (or serializable summaries) so inspect can show payloads — update `Simulation.snapshot()`.

- [ ] **Step 1: Write failing caption tests** using a mini snapshot fixture
- [ ] **Step 2: Implement Zod schema + `evaluateCaptions`**
- [ ] **Step 3: Extend snapshot with demolished records (clone-safe summaries: id, kind, batchId, name/kind from payload)**
- [ ] **Step 4: Export + pass tests + commit** `feat(sim): scenario captions and demolished snapshot detail`

---

### Task 2: ScenarioSession (warmup + auto demolish + follow-up)

**Files:**
- Modify: `packages/sim/src/scenario.ts`
- Modify: `packages/sim/tests/scenario.test.ts`

**Interfaces:**
```typescript
class ScenarioSession {
  constructor(sim: Simulation, def: ScenarioDef);
  /** Call once per sim tick from GameApp after sim.tick(); may call demolish */
  onAfterTick(): { captions: { id: string; text: string }[] };
  reset(simFactory: () => Simulation): void; // or GameApp rebuilds sim
}
```

Simpler approach without owning Simulation:
```typescript
interface ScenarioRuntimeState {
  warmUpRemaining: number;
  followUpRemaining: number | null;
  firedCaptions: Set<string>;
  autoDemolishDone: boolean;
  followUpDone: boolean;
}

function createScenarioRuntime(def: ScenarioDef): ScenarioRuntimeState;
function advanceScenario(
  state: ScenarioRuntimeState,
  sim: Simulation,
  snapshot: FrameSnapshot,
): { captions: { id: string; text: string }[]; didDemolish: boolean };
```

- [ ] **Step 1: Tests for warmup then autoDemolishId; followUp afterTicks**
- [ ] **Step 2: Implement advanceScenario**
- [ ] **Step 3: Commit** `feat(sim): scenario runtime warmup and auto-demolish`

---

### Task 3: Author five scenario JSON files

**Files:**
- Create: `content/scenarios/idle_watch.json`
- Create: `content/scenarios/starve_the_east.json`
- Create: `content/scenarios/blackout.json`
- Create: `content/scenarios/bridge_out.json`
- Create: `content/scenarios/double_cut.json`
- Create: `content/scenarios/index.json` (ordered list of ids)
- Create: `packages/sim/tests/scenarios.content.test.ts` (load all, validate)

- [ ] **Step 1: Author JSON matching ScenarioDef**
- [ ] **Step 2: Content validation tests**
- [ ] **Step 3: Commit** `feat(content): add five Phase 2 scenarios`

---

### Task 4: ScenarioMenu + CaptionBanner UI

**Files:**
- Create: `apps/web/src/ui/ScenarioMenu.ts`
- Create: `apps/web/src/ui/CaptionBanner.ts`
- Modify: `apps/web/src/style.css`
- Modify: `apps/web/src/main.ts` / `GameApp.ts` as needed to pass scenario list

- [ ] **Step 1: ScenarioMenu lists scenarios; onSelect(id) callback; marks active**
- [ ] **Step 2: CaptionBanner.show(text); queues; auto-hide ~8s**
- [ ] **Step 3: Wire into GameApp; load scenarios via import.meta.glob or static imports**
- [ ] **Step 4: Build passes; commit** `feat(web): scenario dock and caption banner`

---

### Task 5: GameApp scenario run loop + slow-mo 0.25×

**Files:**
- Modify: `apps/web/src/GameApp.ts`
- Modify: `apps/web/src/main.ts` (ability to reload Simulation from starter district)

- [ ] **Step 1: SPEEDS = [0.25, 0.5, 1, 2]**
- [ ] **Step 2: `runScenario(def)` resets sim from district JSON, creates runtime, clears captions**
- [ ] **Step 3: Each tick call `advanceScenario`; show captions; apply camera preset if provided**
- [ ] **Step 4: Commit** `feat(web): run scenarios with slow-mo and scheduled demolish`

---

### Task 6: Ghost flow arrows + cascade pulse

**Files:**
- Create: `apps/web/src/scene/FlowArrows.ts`
- Modify: `apps/web/src/scene/CityScene.ts`
- Modify: `apps/web/src/GameApp.ts`

- [ ] **Step 1: FlowArrows.sync(snapshot, selection) draws arrow helpers along paths using `shortestRoadPath` / power adjacency exported from sim**
- [ ] **Step 2: CityScene detects newly starving/unpowered nodes vs previous snapshot and pulses**
- [ ] **Step 3: Commit** `feat(web): ghost flow arrows and cascade pulse`

---

### Task 7: Inspect demolished payload + docs acceptance

**Files:**
- Modify: `apps/web/src/ui/InspectPanel.ts`
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `docs/superpowers/specs/2026-07-20-phase2-readability-design.md` (check acceptance)

- [ ] **Step 1: Inspect shows demolished name/kind from snapshot.demolished**
- [ ] **Step 2: README documents scenarios + slow-mo**
- [ ] **Step 3: `npm test && npm run build`**
- [ ] **Step 4: Commit** `docs: Phase 2 readability acceptance`

---

## Self-Review

1. Spec coverage: scenarios, captions, arrows, pulse, slow-mo, inspect, docs each map to a task.
2. No water/builder scope creep.
3. Snapshot demolished detail unblocks inspect without DOM in sim.
