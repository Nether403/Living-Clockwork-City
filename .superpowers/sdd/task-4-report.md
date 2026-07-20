# Task 4 Report: ScenarioMenu + CaptionBanner UI

## Status

Complete.

## Implementation

- Added `apps/web/src/ui/ScenarioMenu.ts` as a compact left scenario dock with title, one-line blurb, active state, and `onRun(scenarioId)` callback.
- Added `apps/web/src/ui/CaptionBanner.ts` as a bottom-center one-line caption queue with ~8s display, `clear()`, and `dispose()`.
- Wired `GameApp` to own/dispose both UI components.
- Added `GameApp.runScenario(id)` stub that clears captions, clears selection, resets the tick accumulator, highlights the active scenario, and logs the requested run.
- Loaded five authored scenario definitions from static JSON imports plus `content/scenarios/index.json` ordering.
- Added quiet CSS for the dock and banner without dashboard treatment or purple glow.

## Verification

```bash
npm run build -w @lcc/web
```

Passed.

Vite emitted the existing large chunk warning for the app bundle.
