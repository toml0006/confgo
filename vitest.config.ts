import { defineConfig } from "vitest/config";

// Root vitest config — runs Firestore rules tests under tests/. Web app has
// its own vitest config in web/. Keep these scoped so `npm test` at root
// doesn't accidentally pull in jsdom-flavored web tests.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
