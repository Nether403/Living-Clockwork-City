# Task 4 Report: Economy — produce, dispatch, consume, power flags

## Status

**Complete** — implementation added, exported, tests and build pass.

## TDD evidence

### RED

Created `packages/sim/tests/economy.test.ts` with the brief's powered mini-chain scenarios.

Command:

```bash
npm test -w @lcc/sim
```

Expected failure:

```text
FAIL  tests/economy.test.ts [ tests/economy.test.ts ]
Error: Cannot find module '../src/economy' imported from '/workspace/packages/sim/tests/economy.test.ts'

Test Files  1 failed | 3 passed (4)
Tests       12 passed (12)
```

### GREEN

Implemented `packages/sim/src/economy.ts` and exported it from `packages/sim/src/index.ts`.

Command:

```bash
npm test -w @lcc/sim
```

Result:

```text
Test Files  4 passed (4)
Tests       14 passed (14)
```

Build verification:

```bash
npm run build -w @lcc/sim
```

Result: passed.

## Implementation summary

- `updatePowerFlags(state)` uses `getPowerReachable`; operational plants are always powered.
- `produce(state)` adds farm food every 4 ticks when operational, powered, and below capacity.
- `dispatch(state)` sends at most one outbound token per node per tick:
  - farm -> nearest bakery
  - bakery -> nearest market
  - market -> nearest home
  - home -> nearest workplace with labor, including tick-8 labor regeneration before dispatch
- Dispatch uses `shortestRoadPath`, lexicographic target tie-breaks, first-edge capacity checks through `countTokensOnEdge`, and `t${nextTokenId++}` ids.
- `consume(state)` handles home food/starvation every 8 ticks and workplace labor decay/idle workers.

## Tests

- `delivers food to a home when powered`
- `stops bakery production when unpowered`

`buildMiniChain()` includes plant, substation, farm, bakery, market, home, workplace, road edges, power edges, and seeded farm/home stock.

## Self-review / concerns

- Scope follows Task 4 only; no Simulation class added.
- Market dispatch intentionally does not require power per MVP brief.
- Home labor dispatch requires `!starving`; power is not required per binding decision.

## Review fixes: headingTo and unpowered bakery

- Added `Token.headingTo` so moving tokens arrive at the intended endpoint on undirected road paths.
- `dispatch` and queued-token forwarding now set `headingTo` from the current source node to the opposite endpoint of the selected road edge.
- `advanceTokens` now delivers or queues at `token.headingTo`, allowing reverse traversal of stored edge orientation.
- Tightened the unpowered bakery economy test by seeding bakery food while disconnected from power and asserting no token is ever destined for `market`.

Command:

```bash
npm run test -w @lcc/sim
```

Result:

```text
> @lcc/sim@0.1.0 test
> vitest run

 RUN  v3.2.7 /workspace/packages/sim

 ✓ tests/graph.test.ts (4 tests) 3ms
 ✓ tests/tokens.test.ts (8 tests) 4ms
 ✓ tests/economy.test.ts (2 tests) 10ms
 ✓ tests/types-smoke.test.ts (1 test) 1ms

 Test Files  4 passed (4)
      Tests  15 passed (15)
   Start at  23:27:10
   Duration  328ms (transform 96ms, setup 0ms, collect 166ms, tests 18ms, environment 0ms, prepare 222ms)
```
