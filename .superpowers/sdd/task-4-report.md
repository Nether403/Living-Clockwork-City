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
- Existing token model has no travel direction field, so roads are still effectively advanced using each edge's `from -> to` orientation from Task 3.
