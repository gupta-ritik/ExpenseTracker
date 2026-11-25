import { parseEnv } from "@neon/env";
import { z } from "zod";
import neonConfig from "../neon";

const postgresUrl = z.url({ protocol: /^postgres(?:ql)?$/ });
const optionalString = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().min(1).optional(),
);
const authSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
}).refine(
  (env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET),
  { message: "Set both Google credentials or leave both blank.", path: ["GOOGLE_CLIENT_ID"] },
);

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.issues.map(issue =>
      `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }
  return result.data;
}

export function pooledDatabaseUrl() {
  const { DATABASE_URL } = parse(z.object({ DATABASE_URL: postgresUrl }), process.env);
  if (!new URL(DATABASE_URL).hostname.includes("-pooler.")) {
    throw new Error("DATABASE_URL must use the Neon pooled endpoint.");
  }
  return parseEnv(neonConfig, ["DATABASE_URL"]).postgres.databaseUrl;
}

export function migrationDatabaseUrl() {
  const { DATABASE_URL_UNPOOLED } = parse(z.object({ DATABASE_URL_UNPOOLED: postgresUrl }), process.env);
  if (new URL(DATABASE_URL_UNPOOLED).hostname.includes("-pooler.")) {
    throw new Error("DATABASE_URL_UNPOOLED must use the direct Neon endpoint.");
  }
  return parseEnv(neonConfig, ["DATABASE_URL_UNPOOLED"]).postgres.databaseUrlUnpooled;
}

export function authEnvironment() {
  return parse(authSchema, process.env);
}
