import { defineConfig } from "vitest/config";

// Opt-in live checks: `npm run test:groq`. Skipped when GROQ_API_KEY is not set.
export default defineConfig({ test: { include: ["tests/live/**/*.test.ts"] } });
