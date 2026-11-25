import { redirect } from "next/navigation";
import { AuthPanel } from "../../../components/ledger/auth-panel";
import { session } from "../../../lib/auth";
import { authEnvironment } from "../../../lib/env";

export const metadata = { title: "Sign in" };

export default async function SignIn() {
  if (await session()) redirect("/dashboard");
  return <AuthPanel createAccount={false} google={Boolean(authEnvironment().GOOGLE_CLIENT_ID)} />;
}
