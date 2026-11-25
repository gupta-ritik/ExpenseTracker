import { parseEnv } from "@neon/env";
import { z } from "zod";
import neonConfig from "../neon";

const postgresUrl = z.url({ protocol: /^postgres(?:ql)?$/ });
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);
const authSchema = z
  .object({
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
  })
  .refine(
    (env) =>
      Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET),
    {
      message: "Set both Google credentials or leave both blank.",
      path: ["GOOGLE_CLIENT_ID"],
    },
  );

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}

export function pooledDatabaseUrl() {
  const { DATABASE_URL } = parse(
    z.object({ DATABASE_URL: postgresUrl }),
    process.env,
  );
  if (!new URL(DATABASE_URL).hostname.includes("-pooler.")) {
    throw new Error("DATABASE_URL must use the Neon pooled endpoint.");
  }
  return parseEnv(neonConfig, ["DATABASE_URL"]).postgres.databaseUrl;
}

export function migrationDatabaseUrl() {
  const { DATABASE_URL_UNPOOLED } = parse(
    z.object({ DATABASE_URL_UNPOOLED: postgresUrl }),
    process.env,
  );
  if (new URL(DATABASE_URL_UNPOOLED).hostname.includes("-pooler.")) {
    throw new Error("DATABASE_URL_UNPOOLED must use the direct Neon endpoint.");
  }
  return parseEnv(neonConfig, ["DATABASE_URL_UNPOOLED"]).postgres
    .databaseUrlUnpooled;
}

export function authEnvironment() {
  return parse(authSchema, process.env);
}

export function verifiedTlsUrl(connectionString: string) {
  const url = new URL(connectionString);
  url.searchParams.set("sslmode", "verify-full");
  return url.href;
}

export const groqDefaults = {
  alert: "openai/gpt-oss-20b",
  document: "openai/gpt-oss-120b",
} as const;

const cronSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(32).optional(),
);

const encryptionKey = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .regex(/^[A-Za-z0-9+/]{43}=$/, "Use a 32-byte base64 key.")
    .refine(
      (value) => Buffer.from(value, "base64").toString("base64") === value,
      "Use canonical base64 encoding.",
    )
    .optional(),
);

const captureSchema = z.object({
  GROQ_API_KEY: optionalString,
  GROQ_MODEL: optionalString,
  GROQ_MODEL_LARGE: optionalString,
  CRON_SECRET: cronSecret,
  ENCRYPTION_KEY: encryptionKey,
});

export function captureEnvironment(
  values: Record<string, string | undefined> = process.env,
) {
  const env = parse(captureSchema, values);
  return {
    ...env,
    GROQ_MODEL: env.GROQ_MODEL ?? groqDefaults.alert,
    GROQ_MODEL_LARGE: env.GROQ_MODEL_LARGE ?? groqDefaults.document,
  };
}
