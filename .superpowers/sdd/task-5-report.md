# Task 5 Report: Simulation facade

## Status

Complete.

## Implemented

- Added `Simulation` facade with `tick`, `demolish`, `restore`, `snapshot`, `getState`, and `fromMiniChain`.
- Added demolition batching via optional `DemolishedRecord.batchId`.
- Exported `Simulation` from `@lcc/sim`.
- Added tests for:
  - Demolishing the plant darkens the bakery.
  - Restoring the plant brings power back.
  - Demolishing a road edge strands an in-flight token.

## Verification

- `npm run test -w @lcc/sim`
- `npm run build -w @lcc/sim`

Both passed.

## Concerns

None.
