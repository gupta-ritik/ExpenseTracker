import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { db } from "./db";
import * as schema from "./db/auth-schema";
import { authEnvironment } from "./env";
import { seedDefaults } from "./expense/defaults";

function configureAuth() {
  const env = authEnvironment();
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }
      : undefined;

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // The Android app signs in through the Expo plugin and its custom scheme.
    trustedOrigins: [env.BETTER_AUTH_URL, "expensetracker://"],
    plugins: [expo()],
    database: drizzleAdapter(db(), { provider: "pg", schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    socialProviders: google ? { google } : {},
    user: { deleteUser: { enabled: true } },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await seedDefaults(user.id);
          },
        },
      },
    },
  });
}

let instance: ReturnType<typeof configureAuth> | undefined;
export function auth() {
  instance ??= configureAuth();
  return instance;
}

// Read the request headers before touching auth(): during `next build` this
// marks the page dynamic, so the auth client (and its env and database) is
// never built at prerender time.
export const session = cache(async () => {
  const requestHeaders = await headers();
  return auth().api.getSession({ headers: requestHeaders });
});

export async function requireUser() {
  const active = await session();
  if (!active) redirect("/sign-in");
  return active.user;
}
