import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

function directHost(url: string) {
  return new URL(url).hostname.replace("-pooler.", ".");
}

export function loadTestEnvironment() {
  const values = parseEnv(readFileSync(".env.test", "utf8")) as Record<string, string>;
  if (!values.DATABASE_URL || !values.DATABASE_URL_UNPOOLED) {
    throw new Error("Set the isolated Neon test branch URLs in .env.test.");
  }
  const host = directHost(values.DATABASE_URL);
  if (!new URL(values.DATABASE_URL).hostname.includes("-pooler.") || host !== new URL(values.DATABASE_URL_UNPOOLED).hostname) {
    throw new Error("The test file must specify matching pooled and direct endpoints.");
  }
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const { DATABASE_URL: appUrl } = parseEnv(readFileSync(file, "utf8")) as Record<string, string>;
    if (appUrl && directHost(appUrl) === host) {
      throw new Error("The test endpoint matches the application endpoint.");
    }
  }
  for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] as const) {
    if (values[key]) process.env[key] = values[key];
  }
}
