# Task 2 Report: Scenario runtime — warmup, auto demolish, follow-up

## Status

**DONE**

## Summary

Implemented the functional scenario runtime API in `packages/sim/src/scenario.ts`:

- `ScenarioRuntimeState` stores `def`, warmup/follow-up countdowns, fired captions, and demolish completion flags.
- `createScenarioRuntime(def)` initializes runtime state from `ScenarioDef`.
- `advanceScenario(state, sim, snapshot)` evaluates captions, advances warmup, runs auto-demolish, schedules/runs follow-up demolish, and returns `{ captions, didDemolish }`.

When a demolish occurs, `advanceScenario` uses the fresh `FrameSnapshot` returned by `sim.demolish(...)` and re-evaluates captions once more so predicates such as `node_unpowered` and `demolished` can fire in the same step.

## TDD Evidence

### RED

Added `packages/sim/tests/scenario.test.ts` coverage for:

- Runtime state initialization.
- Warmup countdown before auto-demolish.
- Same-step post-demolish caption firing.
- Follow-up demolish after `followUp.afterTicks`.

Command:

```bash
npm run test -w @lcc/sim -- scenario.test.ts
```

Output (excerpt):

```
× scenario runtime > initializes runtime state from the scenario definition
  → (0 , createScenarioRuntime) is not a function
× scenario runtime > waits for warmup before auto-demolishing and fires post-demolish captions
  → (0 , createScenarioRuntime) is not a function
× scenario runtime > runs a follow-up demolish after its delay
  → (0 , createScenarioRuntime) is not a function
```

### GREEN

Implemented the runtime API and helper to add newly-fired caption ids to `firedCaptions`.

Command:

```bash
npm run test -w @lcc/sim -- scenario.test.ts
```

Output:

```
✓ tests/scenario.test.ts (8 tests)

Test Files  1 passed (1)
Tests  8 passed (8)
```

## Verification

```bash
npm run test -w @lcc/sim
npm run build -w @lcc/sim
```

Both passed.

## Commit

```
feat(sim): scenario runtime warmup and auto-demolish
```

Files changed:

- `packages/sim/src/scenario.ts`
- `packages/sim/tests/scenario.test.ts`
- `.superpowers/sdd/task-2-report.md`

## Self-Review

| Check | Result |
|-------|--------|
| Signatures match brief | Yes |
| Runtime state stores `def` | Yes |
| Warmup decrements before auto-demolish | Yes |
| Follow-up delay and demolish covered | Yes |
| Captions de-duped via `firedCaptions` | Yes |
| Post-demolish caption re-evaluation | Yes |
| TDD RED then GREEN | Yes |
| Build passes | Yes |

## Concerns

No known concerns. `sim.demolish(...)` still throws for unknown ids, which matches the existing Simulation API and keeps scenario data errors visible.

## Test Summary

Full `@lcc/sim` suite: 33 tests passing across 7 files.
