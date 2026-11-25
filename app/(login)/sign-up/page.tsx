import { redirect } from "next/navigation";
import { AuthPanel } from "../../../components/ledger/auth-panel";
import { session } from "../../../lib/auth";
import { authEnvironment } from "../../../lib/env";

export const metadata = { title: "Sign up" };

export default async function SignUp() {
  if (await session()) redirect("/dashboard");
  return <AuthPanel createAccount google={Boolean(authEnvironment().GOOGLE_CLIENT_ID)} />;
}
