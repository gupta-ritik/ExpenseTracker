import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "playwright-report/**", "test-results/**", "drizzle/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
