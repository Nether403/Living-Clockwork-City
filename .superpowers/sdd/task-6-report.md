# Task 6 Report: District loader + starter map

## Status

Complete.

## Changes

- Added `loadDistrict(json: unknown): SimState` with strict Zod validation for authored district content.
- Exported the loader from `packages/sim/src/index.ts`.
- Authored `content/districts/starter.json` with required ids and three demolish stories:
  - `road_farm_bakery` is the farm's only road into the food chain.
  - `plant_a` powers `bakery_a` and workplaces through `sub_a`/`sub_b`.
  - `road_bridge` is the only road crossing needed for `home_east` labor to reach `work_west`.
- Added loader, invariant, and scenario tests in `packages/sim/tests/loadDistrict.test.ts`.

## Verification

- `npm run test -w @lcc/sim`
- `npm run build -w @lcc/sim`

Both passed.

## Concerns

- The current economy dispatches to the nearest target kind, so the starter map intentionally makes `home_west` non-labor-producing and `work_east` farther from `home_east` than `work_west` to keep the bridge story deterministic.
