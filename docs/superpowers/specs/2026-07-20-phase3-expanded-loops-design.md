# Phase 3 — Expanded Loops Design

**Date:** 2026-07-20  
**Status:** In progress  
**Related:** [ROADMAP.md](../../../ROADMAP.md), [PRD](../../prd/living-clockwork-city.md), [Phase 2 design](2026-07-20-phase2-readability-design.md)

## 1. Goal

Extend the discrete-token economy with **closed resource loops** so cascades are not only “cut the road / cut the power,” but also “cut the water and the bakery freezes with full shelves” and “block the dump and homes clog.”

## 2. Player experience

1. Idle city still hums with food / energy / labor, plus visible **water tanks** on pipes and **waste bins** on roads.
2. Demolish a **pipe** (or reservoir) → bakery goes **thirsty**, stops shipping bread despite food + power → homes starve.
3. Demolish the **dump road** → waste piles at homes → homes **clog**, labor stops leaving → workplaces idle.
4. New scenarios make those two stories narratable without HUD numbers.

## 3. Scope for this PR (slice A)

### In scope

| Feature | Notes |
|---------|-------|
| Water resource | `water` tokens on `pipe` edges |
| Waste resource | `waste` tokens on `road` edges |
| New nodes | `reservoir`, `dump` (pump deferred) |
| Bakery needs water | Cannot dispatch food when `stock.water < 1`; sets `thirsty` |
| Homes produce waste | Food consume → +1 waste; at capacity → `clogged` |
| Homes dispatch waste | Road path to nearest `dump` |
| Dump sinks waste | Absorbs delivered waste each tick |
| Two scenarios | `dry_bakery`, `waste_backup` |
| Presentation | Token meshes, pipe edges, reservoir/dump meshes, caption flags |

### Deferred (later Phase 3 PRs)

- Housing capacity / overcrowding
- Transit congestion (road capacity stress telegraphing)
- Pump nodes / multi-hop pressure
- Construction material tokens (feeds Phase 4)

## 4. Architecture

```
content/districts/starter.json   (+ reservoir, dump, pipes)
content/scenarios/*.json         (+ dry_bakery, waste_backup)
        │
        ▼
packages/sim  StockPile{water,waste} · pipe paths · thirsty/clogged
        │
        ▼
apps/web  pipe mesh · water/waste tokens · caption predicates
```

**Hard rules unchanged:** sim pure; web reads snapshots and sends commands only.

## 5. Sim rules

### Water

1. `reservoir` produces +1 water every 4 ticks while operational (no power required).
2. `reservoir` dispatches water along **pipe** edges toward nearest `bakery` (and homes if piped).
3. `bakery` requires `stock.water >= 1` to dispatch food; each food dispatch consumes 1 water.
4. `bakery.thirsty = powered && operational && stock.water < 1` (readable cascade flag).
5. Homes optionally consume water every 8 ticks when stocked; `thirsty` if empty (secondary cue).

### Waste

1. When a home consumes food, add +1 waste if under capacity.
2. Homes with waste > 0 dispatch waste tokens on roads toward nearest `dump`.
3. Dump delivery increments dump stock; dump drains 1 waste per tick (sink).
4. `home.clogged = stock.waste >= capacity.waste`.
5. Clogged homes neither regenerate nor dispatch labor.

### Graph

- New edge kind: `pipe` (undirected traversal like road/power).
- `shortestPipePath(state, from, to)` mirrors `shortestRoadPath`.
- Water tokens only advance on pipe edges; waste/food/labor stay on roads.

## 6. Starter district additions

| Id | Role |
|----|------|
| `reservoir_a` | West of bakery; produces water |
| `dump_a` | East bank near homes |
| `pipe_reservoir_bakery` | Primary demolish target for dry bakery |
| `pipe_reservoir_home_west` | Secondary water to west homes |
| `road_home_east_dump` | Demolish target for waste backup |
| `road_home_west_dump` | West homes can also reach dump via market/bridge path or direct spur |

Keep existing Phase 1/2 demolish stories intact (farm road, bridge, plant).

## 7. Scenarios

| Id | Auto-demolish | Caption |
|----|---------------|---------|
| `dry_bakery` | `pipe_reservoir_bakery` | Bakery thirsts; then homes starve |
| `waste_backup` | `road_home_east_dump` (+ follow-up cut west dump spur if needed) | East homes clog; west workplace idles |

## 8. Acceptance checklist (slice A)

- [x] Water tokens move reservoir → bakery on pipes
- [x] Cutting bakery pipe stops bakery food dispatch while powered + stocked with food
- [x] Waste tokens move homes → dump; cutting dump access clogs homes and stops labor
- [x] Two new scenarios load and fire captions (tested in sim)
- [x] Web renders pipes + water/waste tokens + reservoir/dump
- [x] `npm test` and `npm run build` green
- [x] ROADMAP marks Phase 3 in progress; deferred items listed
