# Task 6 Report: Ghost flow arrows + cascade pulse

## Status

Complete.

## Changes

- Added `apps/web/src/scene/FlowArrows.ts` to draw muted amber ghost arrows for selected node outbound routes and selected-edge highlights.
- Wired `FlowArrows` into `CityScene` selection/snapshot sync so arrows clear on null selection and refresh as the graph changes.
- Added `CityScene` cascade pulses for nodes newly becoming starving or unpowered, fading emissive over about one second.
- Cleared scene selection/arrows explicitly when running a scenario reset.

## Verification

- `npm run build -w @lcc/web`

Passed. Vite emitted the existing large chunk warning.

## Concerns

- Edge selection uses a bright single arrow rather than an animated strip.
