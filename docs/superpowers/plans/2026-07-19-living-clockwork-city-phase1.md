# Living Clockwork City Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable web diorama where a hand-authored miniature district runs a discrete food/energy/labor token economy, and demolishing one road, bakery, bridge, or power plant produces a readable cascade.

**Architecture:** Pure TypeScript simulation kernel (`packages/sim`) ticks a city graph of nodes, edges, and resource tokens. A Vite + Three.js app (`apps/web`) renders frame snapshots and sends demolish/restore commands. Presentation never writes sim state.

**Tech Stack:** TypeScript, Vite, Three.js, Vitest, Zod, npm workspaces

## Global Constraints

- Simulation code must not import `three` or any DOM APIs.
- Tick length is fixed at 250ms of game time; wall clock only drives how often ticks are requested.
- Phase 1 resources are exactly `food`, `energy`, `labor` — no water/waste/construction yet.
- One authored district: `content/districts/starter.json`.
- No win/lose screen; sandbox toy only.
- Prefer small focused files; keep sim types in `packages/sim/src/types.ts`.

**Spec:** `docs/superpowers/specs/2026-07-19-living-clockwork-city-design.md`  
**PRD:** `docs/prd/living-clockwork-city.md`

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `package.json` | npm workspaces root scripts |
| `packages/sim/package.json` | Sim package manifest |
| `packages/sim/src/types.ts` | Shared domain types |
| `packages/sim/src/graph.ts` | Graph helpers: neighbors, power reachability |
| `packages/sim/src/tokens.ts` | Token movement / stranding |
| `packages/sim/src/economy.ts` | Production, dispatch, consumption |
| `packages/sim/src/simulation.ts` | `Simulation` class: tick, demolish, restore, snapshot |
| `packages/sim/src/loadDistrict.ts` | Zod-parse district JSON → sim state |
| `packages/sim/src/index.ts` | Public exports |
| `packages/sim/tests/*.test.ts` | Vitest coverage |
| `content/districts/starter.json` | Authored MVP map |
| `apps/web/package.json` | Vite app |
| `apps/web/index.html` | Shell |
| `apps/web/src/main.ts` | Boot |
| `apps/web/src/GameApp.ts` | Loop: input → sim tick → render |
| `apps/web/src/scene/CityScene.ts` | Three.js meshes for nodes/edges/tokens |
| `apps/web/src/ui/InspectPanel.ts` | Selection + demolish/restore controls |
| `README.md` | Install / test / run |

---

### Task 1: Monorepo scaffold + sim types

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/sim/package.json`
- Create: `packages/sim/tsconfig.json`
- Create: `packages/sim/src/types.ts`
- Create: `packages/sim/src/index.ts`
- Create: `packages/sim/tests/types-smoke.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing
- Produces: `ResourceKind`, `NodeKind`, `EdgeKind`, `SimNode`, `SimEdge`, `Token`, `SimState`, `FrameSnapshot`

- [ ] **Step 1: Create root workspace manifest**

```json
{
  "name": "living-clockwork-city",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "npm run test -w @lcc/sim",
    "dev": "npm run dev -w @lcc/web",
    "build": "npm run build -w @lcc/sim && npm run build -w @lcc/web"
  }
}
```

- [ ] **Step 2: Add base TS config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 3: Create sim package + types**

`packages/sim/package.json`:

```json
{
  "name": "@lcc/sim",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vitest": "^3.0.0",
    "zod": "^3.24.0"
  },
  "dependencies": {
    "zod": "^3.24.0"
  }
}
```

`packages/sim/src/types.ts`:

```typescript
export type ResourceKind = "food" | "energy" | "labor";

export type NodeKind =
  | "home"
  | "farm"
  | "bakery"
  | "market"
  | "workplace"
  | "power_plant"
  | "substation"
  | "junction";

export type EdgeKind = "road" | "power";

export type TokenState = "moving" | "queued" | "delivered" | "stranded";

export interface StockPile {
  food: number;
  energy: number;
  labor: number;
}

export interface SimNode {
  id: string;
  kind: NodeKind;
  name: string;
  x: number;
  z: number;
  capacity: StockPile;
  stock: StockPile;
  powered: boolean;
  operational: boolean;
  starving: boolean;
  idleWorkers: number;
}

export interface SimEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  traversalTicks: number;
  capacity: number;
}

export interface Token {
  id: string;
  resource: ResourceKind;
  state: TokenState;
  /** Node id when queued/stranded/delivered; edge id when moving */
  at: string;
  /** 0..1 progress along edge when moving */
  progress: number;
  destination: string;
}

export interface DemolishedRecord {
  kind: "node" | "edge";
  id: string;
  /** Serialized original so restore can put it back */
  payload: SimNode | SimEdge;
}

export interface SimState {
  tick: number;
  nodes: Record<string, SimNode>;
  edges: Record<string, SimEdge>;
  tokens: Record<string, Token>;
  demolished: DemolishedRecord[];
  nextTokenId: number;
}

export interface FrameSnapshot {
  tick: number;
  nodes: SimNode[];
  edges: SimEdge[];
  tokens: Token[];
  demolishedIds: string[];
}
```

- [ ] **Step 4: Write smoke test and export barrel**

```typescript
// packages/sim/tests/types-smoke.test.ts
import { describe, expect, it } from "vitest";
import type { StockPile } from "../src/types";

describe("types", () => {
  it("allows empty stock piles", () => {
    const stock: StockPile = { food: 0, energy: 0, labor: 0 };
    expect(stock.food).toBe(0);
  });
});
```

```typescript
// packages/sim/src/index.ts
export * from "./types.js";
```

- [ ] **Step 5: Install and run tests**

Run:

```bash
npm install
npm run test -w @lcc/sim
```

Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.base.json packages/sim README.md
git commit -m "chore: scaffold monorepo and sim types"
```

---

### Task 2: Graph helpers — connectivity and power reachability

**Files:**
- Create: `packages/sim/src/graph.ts`
- Create: `packages/sim/tests/graph.test.ts`

**Interfaces:**
- Consumes: `SimState`, `SimNode`, `SimEdge`
- Produces:
  - `getRoadNeighbors(state, nodeId): string[]`
  - `getPowerReachable(state): Set<string>` — node ids powered by at least one operational `power_plant` through `power` edges
  - `shortestRoadPath(state, from, to): string[] | null` — list of edge ids

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from "vitest";
import { getPowerReachable, shortestRoadPath } from "../src/graph";
import type { SimState } from "../src/types";

function emptyStock() {
  return { food: 0, energy: 0, labor: 0 };
}

function baseState(): SimState {
  return {
    tick: 0,
    nextTokenId: 1,
    tokens: {},
    demolished: [],
    nodes: {
      plant: {
        id: "plant",
        kind: "power_plant",
        name: "Plant",
        x: 0,
        z: 0,
        capacity: emptyStock(),
        stock: emptyStock(),
        powered: true,
        operational: true,
        starving: false,
        idleWorkers: 0,
      },
      sub: {
        id: "sub",
        kind: "substation",
        name: "Sub",
        x: 1,
        z: 0,
        capacity: emptyStock(),
        stock: emptyStock(),
        powered: false,
        operational: true,
        starving: false,
        idleWorkers: 0,
      },
      bakery: {
        id: "bakery",
        kind: "bakery",
        name: "Bakery",
        x: 2,
        z: 0,
        capacity: emptyStock(),
        stock: emptyStock(),
        powered: false,
        operational: true,
        starving: false,
        idleWorkers: 0,
      },
      farm: {
        id: "farm",
        kind: "farm",
        name: "Farm",
        x: 0,
        z: 1,
        capacity: emptyStock(),
        stock: emptyStock(),
        powered: false,
        operational: true,
        starving: false,
        idleWorkers: 0,
      },
    },
    edges: {
      p1: {
        id: "p1",
        from: "plant",
        to: "sub",
        kind: "power",
        traversalTicks: 1,
        capacity: 99,
      },
      p2: {
        id: "p2",
        from: "sub",
        to: "bakery",
        kind: "power",
        traversalTicks: 1,
        capacity: 99,
      },
      r1: {
        id: "r1",
        from: "farm",
        to: "bakery",
        kind: "road",
        traversalTicks: 4,
        capacity: 2,
      },
    },
  };
}

describe("getPowerReachable", () => {
  it("marks nodes connected to an operational plant", () => {
    const reachable = getPowerReachable(baseState());
    expect(reachable.has("plant")).toBe(true);
    expect(reachable.has("sub")).toBe(true);
    expect(reachable.has("bakery")).toBe(true);
    expect(reachable.has("farm")).toBe(false);
  });

  it("returns only the plant when power line is missing", () => {
    const state = baseState();
    delete state.edges.p1;
    const reachable = getPowerReachable(state);
    expect([...reachable]).toEqual(["plant"]);
  });
});

describe("shortestRoadPath", () => {
  it("finds the farm→bakery road", () => {
    const path = shortestRoadPath(baseState(), "farm", "bakery");
    expect(path).toEqual(["r1"]);
  });

  it("returns null when disconnected", () => {
    const state = baseState();
    delete state.edges.r1;
    expect(shortestRoadPath(state, "farm", "bakery")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm run test -w @lcc/sim`  
Expected: FAIL with cannot find module `../src/graph`

- [ ] **Step 3: Implement `graph.ts`**

```typescript
import type { SimEdge, SimState } from "./types.js";

function roadEdges(state: SimState): SimEdge[] {
  return Object.values(state.edges).filter((e) => e.kind === "road");
}

function powerEdges(state: SimState): SimEdge[] {
  return Object.values(state.edges).filter((e) => e.kind === "power");
}

/** Undirected adjacency for traversal (MVP roads/power are bidirectional). */
function undirectedAdj(
  edges: SimEdge[],
  kindFilter?: (e: SimEdge) => boolean,
): Map<string, { other: string; edgeId: string }[]> {
  const adj = new Map<string, { other: string; edgeId: string }[]>();
  for (const e of edges) {
    if (kindFilter && !kindFilter(e)) continue;
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push({ other: e.to, edgeId: e.id });
    adj.get(e.to)!.push({ other: e.from, edgeId: e.id });
  }
  return adj;
}

export function getRoadNeighbors(state: SimState, nodeId: string): string[] {
  const adj = undirectedAdj(roadEdges(state));
  return (adj.get(nodeId) ?? []).map((x) => x.other);
}

export function getPowerReachable(state: SimState): Set<string> {
  const plants = Object.values(state.nodes).filter(
    (n) => n.kind === "power_plant" && n.operational,
  );
  const adj = undirectedAdj(powerEdges(state));
  const reachable = new Set<string>();
  const stack = plants.map((p) => p.id);
  for (const id of stack) reachable.add(id);
  while (stack.length) {
    const cur = stack.pop()!;
    for (const next of adj.get(cur) ?? []) {
      if (!reachable.has(next.other) && state.nodes[next.other]) {
        reachable.add(next.other);
        stack.push(next.other);
      }
    }
  }
  return reachable;
}

export function shortestRoadPath(
  state: SimState,
  from: string,
  to: string,
): string[] | null {
  if (from === to) return [];
  const adj = undirectedAdj(roadEdges(state));
  const queue = [from];
  const prev = new Map<string, { node: string; edgeId: string }>();
  const seen = new Set<string>([from]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of adj.get(cur) ?? []) {
      if (seen.has(n.other)) continue;
      seen.add(n.other);
      prev.set(n.other, { node: cur, edgeId: n.edgeId });
      if (n.other === to) {
        const edges: string[] = [];
        let walk: string | undefined = to;
        while (walk && walk !== from) {
          const p = prev.get(walk)!;
          edges.push(p.edgeId);
          walk = p.node;
        }
        return edges.reverse();
      }
      queue.push(n.other);
    }
  }
  return null;
}
```

- [ ] **Step 4: Export and re-run tests**

Add to `packages/sim/src/index.ts`:

```typescript
export * from "./graph.js";
```

Run: `npm run test -w @lcc/sim`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sim
git commit -m "feat(sim): add road pathfinding and power reachability"
```

---

### Task 3: Token transit + demolish stranding

**Files:**
- Create: `packages/sim/src/tokens.ts`
- Create: `packages/sim/tests/tokens.test.ts`

**Interfaces:**
- Consumes: `SimState`, graph helpers
- Produces:
  - `advanceTokens(state): void` — move tokens along edges by `1/traversalTicks`
  - `strandTokensOnEdge(state, edgeId): void`
  - `strandTokensAtNode(state, nodeId): void`
  - `countTokensOnEdge(state, edgeId): number`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from "vitest";
import { advanceTokens, strandTokensOnEdge } from "../src/tokens";
import type { SimState, Token } from "../src/types";

function stateWithMovingToken(): SimState {
  const token: Token = {
    id: "t1",
    resource: "food",
    state: "moving",
    at: "r1",
    progress: 0,
    destination: "bakery",
  };
  return {
    tick: 0,
    nextTokenId: 2,
    demolished: [],
    nodes: {
      farm: {
        id: "farm",
        kind: "farm",
        name: "Farm",
        x: 0,
        z: 0,
        capacity: { food: 10, energy: 0, labor: 0 },
        stock: { food: 0, energy: 0, labor: 0 },
        powered: true,
        operational: true,
        starving: false,
        idleWorkers: 0,
      },
      bakery: {
        id: "bakery",
        kind: "bakery",
        name: "Bakery",
        x: 4,
        z: 0,
        capacity: { food: 10, energy: 0, labor: 0 },
        stock: { food: 0, energy: 0, labor: 0 },
        powered: true,
        operational: true,
        starving: false,
        idleWorkers: 0,
      },
    },
    edges: {
      r1: {
        id: "r1",
        from: "farm",
        to: "bakery",
        kind: "road",
        traversalTicks: 4,
        capacity: 2,
      },
    },
    tokens: { t1: token },
  };
}

describe("advanceTokens", () => {
  it("moves a token along an edge and delivers after enough ticks", () => {
    const state = stateWithMovingToken();
    for (let i = 0; i < 3; i++) advanceTokens(state);
    expect(state.tokens.t1.state).toBe("moving");
    expect(state.tokens.t1.progress).toBeCloseTo(0.75);
    advanceTokens(state);
    expect(state.tokens.t1.state).toBe("delivered");
    expect(state.tokens.t1.at).toBe("bakery");
    expect(state.nodes.bakery.stock.food).toBe(1);
  });
});

describe("strandTokensOnEdge", () => {
  it("marks in-flight tokens stranded when an edge is demolished", () => {
    const state = stateWithMovingToken();
    advanceTokens(state);
    strandTokensOnEdge(state, "r1");
    expect(state.tokens.t1.state).toBe("stranded");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test -w @lcc/sim`  
Expected: FAIL missing `../src/tokens`

- [ ] **Step 3: Implement `tokens.ts`**

```typescript
import type { ResourceKind, SimState, Token } from "./types.js";

export function countTokensOnEdge(state: SimState, edgeId: string): number {
  return Object.values(state.tokens).filter(
    (t) => t.state === "moving" && t.at === edgeId,
  ).length;
}

export function strandTokensOnEdge(state: SimState, edgeId: string): void {
  for (const t of Object.values(state.tokens)) {
    if (t.state === "moving" && t.at === edgeId) {
      t.state = "stranded";
      t.progress = 0;
    }
  }
}

export function strandTokensAtNode(state: SimState, nodeId: string): void {
  for (const t of Object.values(state.tokens)) {
    if (
      (t.state === "queued" || t.state === "moving") &&
      (t.at === nodeId || dependsOnNode(state, t, nodeId))
    ) {
      t.state = "stranded";
      t.at = nodeId;
      t.progress = 0;
    }
  }
}

function dependsOnNode(state: SimState, token: Token, nodeId: string): boolean {
  if (token.state !== "moving") return false;
  const edge = state.edges[token.at];
  return !!edge && (edge.from === nodeId || edge.to === nodeId);
}

export function advanceTokens(state: SimState): void {
  for (const token of Object.values(state.tokens)) {
    if (token.state !== "moving") continue;
    const edge = state.edges[token.at];
    if (!edge) {
      token.state = "stranded";
      continue;
    }
    const step = 1 / Math.max(1, edge.traversalTicks);
    token.progress += step;
    if (token.progress >= 1) {
      deliver(state, token, edge.to === token.destination ? edge.to : edge.to);
      // MVP: edges are one hop from producer toward destination; if destination
      // is edge.to when pathing placed it so, deliver there. If multi-hop, the
      // economy dispatcher sets destination to final sink and re-queues.
      if (token.destination !== edge.to && token.destination !== edge.from) {
        // Arrived at intermediate node — queue for next hop.
        token.state = "queued";
        token.at = edge.to;
        token.progress = 0;
      }
    }
  }
}

function deliver(state: SimState, token: Token, nodeId: string): void {
  const node = state.nodes[nodeId];
  if (!node) {
    token.state = "stranded";
    return;
  }
  if (nodeId === token.destination) {
    addStock(node.stock, token.resource, 1);
    token.state = "delivered";
    token.at = nodeId;
    token.progress = 0;
  } else {
    token.state = "queued";
    token.at = nodeId;
    token.progress = 0;
  }
}

function addStock(
  stock: { food: number; energy: number; labor: number },
  resource: ResourceKind,
  amount: number,
): void {
  stock[resource] += amount;
}
```

> **Note for implementer:** When wiring multi-hop paths in Task 4, dispatch should set `destination` to the final sink and, on intermediate arrival, choose the next edge from `shortestRoadPath`. Adjust `advanceTokens` so that reaching `edge.to` always queues at that node unless `edge.to === token.destination`. Prefer this simpler rule and delete the redundant ternary in `deliver`’s call site:

```typescript
token.progress += step;
if (token.progress >= 1) {
  const arrivedAt = edge.to; // if travel direction matters later, store `headingTo`
  if (arrivedAt === token.destination) {
    deliverFinal(state, token, arrivedAt);
  } else {
    token.state = "queued";
    token.at = arrivedAt;
    token.progress = 0;
  }
}
```

Use the simpler rule in the actual commit (tests above stay valid for one-hop paths).

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm run test -w @lcc/sim`

- [ ] **Step 5: Commit**

```bash
git add packages/sim
git commit -m "feat(sim): advance tokens and strand on demolished edges"
```

---

### Task 4: Economy — produce, dispatch, consume, power flags

**Files:**
- Create: `packages/sim/src/economy.ts`
- Create: `packages/sim/tests/economy.test.ts`

**Interfaces:**
- Consumes: `SimState`, `getPowerReachable`, `shortestRoadPath`, `countTokensOnEdge`
- Produces:
  - `updatePowerFlags(state): void`
  - `produce(state): void`
  - `dispatch(state): void`
  - `consume(state): void`

Rules for MVP:

| Node | Produces | Requires |
|------|----------|----------|
| `farm` | +1 food stock / 4 ticks if powered | power |
| `bakery` | convert 1 food → 1 food_out buffer as crate toward market | power + food stock ≥ 1 |
| `market` | holds food; homes pull from nearest market | power optional for MVP |
| `power_plant` | marks energy availability via power graph | operational |
| `home` | consumes 1 food / 8 ticks; labor regenerates workers | food buffer |
| `workplace` | needs `labor` tokens; idle if none | power |

Simplification for Phase 1 bakery: treat bakery output as `food` tokens labeled for markets (same resource kind). Farms emit raw food to bakeries; bakeries emit food to markets; markets emit food to homes. Chain is encoded by dispatch targets, not separate resource types.

- [ ] **Step 1: Write failing scenario test**

```typescript
import { describe, expect, it } from "vitest";
import { consume, dispatch, produce, updatePowerFlags } from "../src/economy";
import { advanceTokens } from "../src/tokens";
import type { SimState } from "../src/types";

// Build a tiny powered farm→bakery→market→home chain in the test.
// Assert: after N ticks, home.stock.food increases while powered.
// Assert: after deleting power edge, bakery stops emitting new tokens.

describe("economy chain", () => {
  it("delivers food to a home when powered", () => {
    const state = buildMiniChain(); // implement helper in test file
    updatePowerFlags(state);
    for (let i = 0; i < 40; i++) {
      produce(state);
      dispatch(state);
      advanceTokens(state);
      consume(state);
      state.tick++;
    }
    expect(state.nodes.home.stock.food).toBeGreaterThan(0);
    expect(state.nodes.home.starving).toBe(false);
  });

  it("stops bakery production when unpowered", () => {
    const state = buildMiniChain();
    delete state.edges.power_bakery;
    updatePowerFlags(state);
    const before = Object.keys(state.tokens).length;
    for (let i = 0; i < 20; i++) {
      produce(state);
      dispatch(state);
      advanceTokens(state);
      consume(state);
      state.tick++;
    }
    // farm may still try, but bakery should not convert; home eventually starves
    expect(state.nodes.bakery.powered).toBe(false);
    expect(state.nodes.home.starving).toBe(true);
    expect(Object.keys(state.tokens).length).toBeGreaterThanOrEqual(before);
  });
});
```

Implement `buildMiniChain()` inside the test file with nodes `farm`, `bakery`, `market`, `home`, `plant`, `sub` and edges linking them (roads + power). Seed `farm.stock.food = 5`, `home.stock.food = 2`.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `economy.ts`**

Core logic sketch (full code belongs in the file):

```typescript
export function updatePowerFlags(state: SimState): void {
  const powered = getPowerReachable(state);
  for (const node of Object.values(state.nodes)) {
    if (node.kind === "power_plant" && node.operational) {
      node.powered = true;
    } else {
      node.powered = powered.has(node.id);
    }
  }
}

export function produce(state: SimState): void {
  for (const node of Object.values(state.nodes)) {
    if (!node.operational || !node.powered) continue;
    if (node.kind === "farm" && state.tick % 4 === 0) {
      if (node.stock.food < node.capacity.food) node.stock.food += 1;
    }
    // bakery conversion happens at dispatch time from stock
  }
}

export function dispatch(state: SimState): void {
  // For each producer kind, find demand sinks, path, spawn token if edge has capacity.
  // Targets: farm→bakery, bakery→market, market→home, home→workplace (labor).
}

export function consume(state: SimState): void {
  for (const node of Object.values(state.nodes)) {
    if (node.kind === "home" && state.tick % 8 === 0) {
      if (node.stock.food > 0) {
        node.stock.food -= 1;
        node.starving = false;
      } else {
        node.starving = true;
      }
    }
    if (node.kind === "workplace") {
      node.idleWorkers = node.powered ? Math.max(0, 2 - node.stock.labor) : 2;
    }
  }
}
```

Fill in `dispatch` completely: pick at most one outbound token per node per tick; use `shortestRoadPath`; set token `at` to first edge id, `state: "moving"`, `progress: 0`; decrement source stock.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/sim
git commit -m "feat(sim): produce, dispatch, consume, and power flags"
```

---

### Task 5: Simulation facade — tick, demolish, restore, snapshot

**Files:**
- Create: `packages/sim/src/simulation.ts`
- Create: `packages/sim/tests/simulation.test.ts`
- Modify: `packages/sim/src/index.ts`

**Interfaces:**
- Consumes: economy + tokens modules
- Produces:

```typescript
export class Simulation {
  constructor(state: SimState);
  tick(): FrameSnapshot;
  demolish(id: string): FrameSnapshot; // node or edge id
  restore(id: string): FrameSnapshot;
  snapshot(): FrameSnapshot;
  getState(): Readonly<SimState>;
}
```

Rules:

- `demolish(nodeId)`: remove node + incident edges; strand tokens; push `DemolishedRecord`s (node and each edge).
- `demolish(edgeId)`: remove edge; strand tokens on it; record payload.
- `restore(id)`: pop matching demolished records for that id (and for nodes, also restore their edges demolished in the same action — store `batchId` or restore list). MVP approach: each demolish stores an array batch; `restore` takes the batch’s primary id and restores the whole batch.
- After demolish/restore, call `updatePowerFlags`.

- [ ] **Step 1: Write failing tests for demolish cascade**

```typescript
describe("Simulation.demolish", () => {
  it("darkens bakery when power plant is demolished", () => {
    const sim = Simulation.fromMiniChain();
    for (let i = 0; i < 5; i++) sim.tick();
    sim.demolish("plant");
    const snap = sim.snapshot();
    const bakery = snap.nodes.find((n) => n.id === "bakery")!;
    expect(bakery.powered).toBe(false);
    expect(snap.demolishedIds).toContain("plant");
  });

  it("restore brings power back", () => {
    const sim = Simulation.fromMiniChain();
    sim.demolish("plant");
    sim.restore("plant");
    const bakery = sim.snapshot().nodes.find((n) => n.id === "bakery")!;
    expect(bakery.powered).toBe(true);
  });
});
```

- [ ] **Step 2: Implement `simulation.ts` with tick order**

Tick order (must match design):

1. `updatePowerFlags`
2. `produce`
3. `dispatch`
4. `advanceTokens`
5. `consume`
6. increment `tick`
7. return `snapshot()`

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit**

```bash
git add packages/sim
git commit -m "feat(sim): Simulation tick, demolish, and restore API"
```

---

### Task 6: District loader + starter map

**Files:**
- Create: `packages/sim/src/loadDistrict.ts`
- Create: `packages/sim/tests/loadDistrict.test.ts`
- Create: `content/districts/starter.json`

**Interfaces:**
- Produces: `loadDistrict(json: unknown): SimState` (Zod-validated)

Starter map must include all three demolish stories from the design spec:

1. Farm road cut isolates bakery inputs.
2. Power plant demolition darkens industry.
3. River bridge cut separates east homes from west workplaces.

Suggested node ids: `farm_a`, `bakery_a`, `market_a`, `home_west`, `home_east`, `work_west`, `work_east`, `plant_a`, `sub_a`, `sub_b`, `bridge_north` (as a road edge id `road_bridge`), junctions as needed.

- [ ] **Step 1: Define Zod schema matching `SimNode`/`SimEdge` content format**

Content format (no runtime flags):

```json
{
  "id": "starter",
  "name": "Starter District",
  "nodes": [
    {
      "id": "farm_a",
      "kind": "farm",
      "name": "Wheat Farm",
      "x": -6,
      "z": 2,
      "capacity": { "food": 20, "energy": 0, "labor": 0 },
      "stock": { "food": 8, "energy": 0, "labor": 0 }
    }
  ],
  "edges": [
    {
      "id": "road_farm_bakery",
      "from": "farm_a",
      "to": "bakery_a",
      "kind": "road",
      "traversalTicks": 6,
      "capacity": 3
    }
  ]
}
```

Loader sets `powered/operational/starving/idleWorkers` defaults.

- [ ] **Step 2: Write test loading `starter.json` and asserting key ids exist**

- [ ] **Step 3: Author full `starter.json` with ~20–40 nodes/edges**

- [ ] **Step 4: Scenario tests**

```typescript
describe("starter demolish stories", () => {
  it("cutting farm road eventually starves homes", () => { /* ... */ });
  it("demolishing plant unpowers bakery", () => { /* ... */ });
  it("removing bridge idles east workers", () => { /* ... */ });
});
```

- [ ] **Step 5: Commit**

```bash
git add packages/sim content
git commit -m "feat: add starter district and Zod loader"
```

---

### Task 7: Web app shell + CityScene rendering

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.ts`
- Create: `apps/web/src/GameApp.ts`
- Create: `apps/web/src/scene/CityScene.ts`
- Create: `apps/web/src/style.css`

**Interfaces:**
- Consumes: `Simulation`, `FrameSnapshot` from `@lcc/sim`
- Produces: orbit camera diorama; meshes for nodes/edges/tokens updated each frame from snapshot

Visual mapping:

| Kind | Mesh cue |
|------|----------|
| home | warm small block |
| farm | green flat pad |
| bakery | taller warm block |
| market | awning box |
| workplace | blue-gray block |
| power_plant | chimney block |
| substation | small pole |
| road edge | dark strip |
| power edge | thin bright strip |
| food token | crate |
| energy token | battery nub |
| labor token | simple figure |
| unpowered | multiply color × 0.35 |
| stranded token | tip over / stop |

- [ ] **Step 1: Scaffold Vite app depending on `@lcc/sim` and `three`**

- [ ] **Step 2: Implement `CityScene.sync(snapshot)`** — create missing meshes, update token positions by lerping edge endpoints with `progress`, dim unpowered nodes, hide demolished ids

- [ ] **Step 3: Implement `GameApp` fixed-step loop**

```typescript
const TICK_MS = 250;
// accumulate frame dt; while acc >= TICK_MS: snapshot = sim.tick(); acc -= TICK_MS
// scene.sync(snapshot); renderer.render(scene, camera)
```

- [ ] **Step 4: Manual check**

Run: `npm run dev`  
Expected: browser shows district with moving tokens; orbit works.

- [ ] **Step 5: Commit**

```bash
git add apps/web package-lock.json
git commit -m "feat(web): render city snapshot with Three.js diorama"
```

---

### Task 8: Selection, demolish, restore UI

**Files:**
- Create: `apps/web/src/ui/InspectPanel.ts`
- Create: `apps/web/src/input/Picker.ts`
- Modify: `apps/web/src/GameApp.ts`
- Modify: `apps/web/src/style.css`

**Interfaces:**
- Raycast click → select node or edge
- Inspect panel shows name, kind, powered, stock, queue count
- Buttons: Demolish / Restore
- Keyboard: `Space` pause, `[` `]` speed 0.5× / 1× / 2× (optional but useful)

- [ ] **Step 1: Implement picker using `Raycaster` against node/edge meshes (`userData.simId`)**

- [ ] **Step 2: Wire demolish/restore to `Simulation` and refresh snapshot immediately**

- [ ] **Step 3: Manual verify three stories**

1. Demolish `road_farm_bakery` → crates stop; homes starve.  
2. Demolish `plant_a` → lights dim; bakery stops.  
3. Demolish `road_bridge` → east labor stranded/idle workplaces.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): inspect panel with demolish and restore"
```

---

### Task 9: README polish + acceptance pass

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-19-living-clockwork-city-design.md` (check off acceptance items that are met after implementation — do not check them in the plan PR)

- [ ] **Step 1: Write README**

Sections: Concept, Phase 1 scope, Install, Test, Run, Demolish scenarios to try, Repo layout, Roadmap phases 2–5.

- [ ] **Step 2: Run full verification**

```bash
npm test
npm run build
npm run dev
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: explain how to run the Living Clockwork City demo"
```

---

## Phase 2+ Roadmap (not in this plan)

1. **Readability pack** — better cascade telegraphing, scenario presets menu, ghost flow arrows on hover.
2. **Expanded loops** — water, waste, housing capacity, congestion.
3. **Limited builder** — repair kits / place from a palette of 5 pieces.
4. **Content pipeline** — district editor, balance HUD for designers.

---

## Self-Review Notes

1. **Spec coverage:** Phase 1 acceptance items map to Tasks 5–9 (sim API, starter district, web render, demolish UX, README).
2. **No placeholders left in task outcomes:** economy dispatch must be fully implemented in Task 4 (not stubbed); starter.json must encode three demolish stories in Task 6.
3. **Type consistency:** `FrameSnapshot`, `SimState`, `ResourceKind` names are stable across tasks; tick order is fixed in Task 5.
