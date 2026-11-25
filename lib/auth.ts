import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db";
import * as schema from "./db/auth-schema";
import { authEnvironment } from "./env";
import { seedDefaults } from "./expense/defaults";

function configureAuth() {
  const env = authEnvironment();
  const google = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
    : undefined;

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db(), { provider: "pg", schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    socialProviders: google ? { google } : {},
    user: { deleteUser: { enabled: true } },
    databaseHooks: {
      user: { create: { after: async (user) => { await seedDefaults(user.id); } } },
    },
  });
}

let instance: ReturnType<typeof configureAuth> | undefined;
export function auth() {
  instance ??= configureAuth();
  return instance;
}

export const session = cache(async () => auth().api.getSession({ headers: await headers() }));

export async function requireUser() {
  const active = await session();
  if (!active) redirect("/sign-in");
  return active.user;
}
