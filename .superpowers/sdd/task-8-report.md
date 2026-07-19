# Task 8 Report: Selection, demolish, restore UI

## Status

Implemented.

## Changes

- Added `apps/web/src/input/Picker.ts` for click raycasting against node/edge objects only.
  - Ignores token meshes by only using scene-provided node/edge pickables.
  - Treats pointer movement over 4px between down/up as an orbit drag, not a selection.
- Added `apps/web/src/ui/InspectPanel.ts` for a single DOM inspect panel.
  - Shows selected name/id, node/edge kind, node powered state, stock summary, queued token count, and edge endpoints/capacity.
  - Enables Demolish only for active node/edge selections.
  - Enables Restore only when `snapshot.demolishedIds.includes(selectedId)`.
- Wired `GameApp.ts`.
  - Selection updates panel and scene highlight.
  - Demolish/restore call `Simulation.demolish(id)` / `Simulation.restore(id)` and immediately sync returned snapshots.
  - Space toggles pause.
  - `[` and `]` step speed through 0.5x / 1x / 2x via `accumulator += dt * speed`.
- Updated `CityScene.ts`.
  - Exposes canvas, camera, and pickable node/edge objects for Picker.
  - Applies a subtle warm amber emissive highlight to the selected mesh and reapplies it after scene sync.
- Updated `style.css` with a readable atmospheric panel and mobile bottom-sheet layout.

## Verification

- `npm run build -w @lcc/web` passed.
  - Vite emitted a chunk-size warning for the bundled app JS; build succeeded.

## Manual checklist

Headless environment prevents full click verification here. Browser checks to run:

1. Select and demolish `road_farm_bakery`: crates should stop and homes should eventually starve.
2. Select and demolish `plant_a`: lights should dim and bakery should stop.
3. Select and demolish `road_bridge`: east labor should become stranded and east workplaces idle.

For each story, verify selection highlight, inspect panel details, Demolish disabled after demolition, Restore enabled while demolished, and Restore rehydrates the selected item.
