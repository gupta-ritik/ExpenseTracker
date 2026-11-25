import { betterAuth } from "better-auth/minimal";

export const auth = betterAuth({
  baseURL: "http://localhost:3000",
  emailAndPassword: { enabled: true },
});
