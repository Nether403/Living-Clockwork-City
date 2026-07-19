import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@lcc/sim": new URL("../../packages/sim/src/index.ts", import.meta.url)
        .pathname,
    },
  },
  server: {
    fs: {
      allow: [
        new URL(".", import.meta.url).pathname,
        new URL("../..", import.meta.url).pathname,
      ],
    },
  },
});
