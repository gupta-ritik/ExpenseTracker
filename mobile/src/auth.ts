import { expoClient } from "@better-auth/expo/client";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { createAuthClient } from "better-auth/react";

export const apiBaseUrl = String(
  Constants.expoConfig?.extra?.apiBaseUrl,
).replace(/\/$/, "");
export const auth = createAuthClient({
  baseURL: apiBaseUrl,
  plugins: [
    expoClient({
      scheme: "expensetracker",
      storagePrefix: "expensetracker",
      storage: SecureStore,
    }),
  ],
});
