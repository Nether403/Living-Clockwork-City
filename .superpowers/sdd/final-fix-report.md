## Final branch review fixes

- Standardized `typescript` to `^5.9.0` in both `packages/sim` and `apps/web`; `npm install` resolved both workspaces to `typescript@5.9.3` and removed TS 7 from the lockfile.
- Moved `typescript`, `vite`, and `@types/three` to `apps/web` devDependencies while keeping `three` and `@lcc/sim` as dependencies.
- Kept `zod` only in `packages/sim` dependencies and left `vitest`/`typescript` in devDependencies.
- Removed the duplicate `stampPickData` call in `CityScene.createTokenObject`.
- Verification: `npm test` passed; `npm run build` passed with Vite's existing chunk-size warning.
