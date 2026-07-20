# Phase 2 — Readability & Scenario Pack Design

**Date:** 2026-07-20  
**Status:** Ready for implementation  
**Related:** [ROADMAP.md](../../../ROADMAP.md), [PRD](../../prd/living-clockwork-city.md), [Phase 1 design](2026-07-19-living-clockwork-city-design.md)

## 1. Goal

Make the Phase 1 toy *communicative*. A new player should run five authored scenarios and explain each cascade without reading stock numbers.

## 2. Player experience

1. Open the demo → see a **scenario dock** (not a dashboard): brand-scale title stays the diorama; scenarios sit as a quiet list.
2. Pick a scenario → camera eases to a preset framing; city resets; optional auto-demolish after a short “watch the idle machine” beat.
3. Hover/select a node or edge → **ghost flow arrows** show typical outbound routes for that piece.
4. After demolish, as predicates trip (homes starving, bakery unpowered, workplaces idle), an **after-action caption** appears once per scenario run (“The east bank went hungry — the farm road was the only supply path.”).
5. Speed includes **slow-mo** (0.25×) so cascades are watchable.

## 3. Scope

### In scope

| Feature | Notes |
|---------|-------|
| Scenario content format | JSON under `content/scenarios/` |
| Scenario menu UI | Select + Reset run |
| Five scenarios | See §5 |
| Ghost flow arrows | On hover/selection for nodes (and edges: highlight path role) |
| Cascade telegraphing | Stronger queue stacks, stranded token pose, unpowered dim already exists — add pulse on newly-failed nodes |
| After-action captions | Fired from declarative predicates evaluated each tick |
| Slow-mo 0.25× | Extend existing speed ladder |
| Inspect demolished detail | Show payload name/kind/stock from demolished records |

### Out of scope

- New resource loops (Phase 3)
- Building/placement (Phase 4)
- Map editor (Phase 5)
- Audio redesign (optional one-shot whoosh is OK, not required)

## 4. Architecture

```
content/scenarios/*.json
        │
        ▼
packages/sim  ScenarioRunner / evaluateCaptionPredicates (pure)
        │ commands: loadDistrict, demolish, tick
        ▼
apps/web  ScenarioMenu + CaptionBanner + FlowArrows (Three.js) + GameApp
```

**Hard rule unchanged:** sim stays pure; web never mutates sim internals.

### New sim surfaces

```typescript
interface ScenarioDef {
  id: string;
  title: string;
  blurb: string;
  districtId: string;          // e.g. "starter"
  camera?: { x: number; y: number; z: number; targetX: number; targetZ: number };
  warmUpTicks: number;         // idle ticks before auto action
  autoDemolishId?: string;     // optional
  captions: CaptionRule[];
}

interface CaptionRule {
  id: string;
  when: CaptionPredicate;
  text: string;
}

type CaptionPredicate =
  | { type: "node_flag"; nodeId: string; flag: "starving" | "unpowered" | "idle_workers"; minIdle?: number }
  | { type: "any_home_starving" }
  | { type: "node_unpowered"; nodeId: string }
  | { type: "demolished"; id: string };
```

`evaluateCaptions(snapshot, rules, alreadyFired: Set<string>): string[]` returns new caption texts to show (ids marked fired by the web layer or a small `ScenarioSession` helper in sim).

Prefer putting predicate evaluation in `packages/sim` so it is unit-tested.

## 5. Five scenarios (starter district)

| Id | Title | Auto-demolish | Caption idea |
|----|-------|---------------|--------------|
| `idle_watch` | Idle Watch | none | (optional) none — teach observation |
| `starve_the_east` | Starve the East | `road_farm_bakery` | Homes go hungry after the farm road is cut |
| `blackout` | Blackout | `plant_a` | Bakery darkens; food chain freezes |
| `bridge_out` | Bridge Out | `road_bridge` | West workplace idles without east labor |
| `double_cut` | Double Cut | `road_farm_bakery` then (manual second target hinted) — **MVP:** auto only first; caption tells player to also cut `plant_a` OR auto-demolish plant after N ticks via `followUpDemolish` | Compound cascade |

For `double_cut`, support optional `followUp?: { afterTicks: number; demolishId: string }` on the scenario def.

## 6. Presentation details

### Ghost flow arrows

- When a **node** is selected/hovered: draw translucent arrows along `shortestRoadPath` (or power edges for plants/subs) toward its typical dispatch targets (reuse economy target rules: farm→bakery, bakery→market, market→home, home→workplace; power_plant→reachable power neighbors).
- When an **edge** is selected: pulse that edge; show endpoints.
- Arrows are presentation-only (computed in web from snapshot graph helpers exported by sim).

### Cascade pulse

- When a node newly becomes `starving` or newly `!powered` (vs previous snapshot), briefly pulse emissive for ~1s.

### Caption banner

- One line, bottom-center, auto-hide after ~8s or on scenario reset.
- No card stack; one caption visible at a time (queue if multiple fire).

### Scenario dock

- Left or bottom quiet list: title + one-line blurb.
- Active scenario highlighted.
- **Run** applies reset+warmup+auto demolish schedule.
- Keep first viewport brand-first: dock must not overpower the diorama (compact type, no dashboard stats).

## 7. Acceptance checklist

- [x] Five scenarios loadable from `content/scenarios/`
- [x] Scenario menu can run each; city resets cleanly
- [x] Ghost arrows appear on node selection
- [x] Slow-mo 0.25× available
- [x] After-action captions fire for starve / blackout / bridge scenarios (tested in sim)
- [x] Inspect panel shows demolished payload details
- [x] `npm test` and `npm run build` green
- [x] README + ROADMAP updated for Phase 2 status
