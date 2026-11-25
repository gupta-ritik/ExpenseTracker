"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const client = createAuthClient();
const schema = z.object({
  name: z.string().trim().max(80), email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});
type Fields = z.input<typeof schema>;

export function AuthPanel({ createAccount, google }: { createAccount: boolean; google: boolean }) {
  const [shown, setShown] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { register, handleSubmit, setError: fieldError, formState: { errors, isSubmitting } } = useForm<Fields>({
    resolver: zodResolver(schema), defaultValues: { name: "", email: "", password: "" },
  });
  async function submit(fields: Fields) {
    setError("");
    if (createAccount && !fields.name) {
      fieldError("name", { message: "Enter your name." }, { shouldFocus: true });
      return;
    }
    try {
      const response = createAccount ? await client.signUp.email(fields) : await client.signIn.email({
        email: fields.email, password: fields.password,
      });
      if (response.error) {
        setError(response.error.message || "Your request could not be completed.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch { setError("Could not connect. Try again."); }
  }
  return <main id="main" className="auth-page">
    <a className="skip-link" href="#auth-form">Skip to content</a>
    <Link className="brand" href="/"><span aria-hidden>₹</span> ExpenseTracker</Link>
    <section id="auth-form" className="auth-card panel">
      <h1>{createAccount ? "Create your account" : "Sign in"}</h1>
      <form className="stack" onSubmit={handleSubmit(submit)}>
        {createAccount && <label className="field">Name<input autoComplete="name" {...register("name")} />
          {errors.name && <span className="field-error">{errors.name.message}</span>}</label>}
        <label className="field">Email<input type="email" autoComplete="email" {...register("email")} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}</label>
        <div className="field"><label htmlFor="password">Password</label>
          <div className="password-row"><input id="password" type={shown ? "text" : "password"}
            autoComplete={createAccount ? "new-password" : "current-password"} {...register("password")} />
          <button className="button icon" aria-label={shown ? "Hide password" : "Show password"} type="button" onClick={() => setShown(!shown)}>
            {shown ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="submit" className="button primary" disabled={isSubmitting}>
          {isSubmitting ? "Please wait…" : createAccount ? "Create account" : "Sign in"}
        </button>
      </form>
      {google && <button type="button" className="button" onClick={() => void client.signIn.social({ provider: "google", callbackURL: "/dashboard" })}>
        Continue with Google</button>}
      <p>{createAccount ? "Already have an account? " : "New to ExpenseTracker? "}
        <Link href={createAccount ? "/sign-in" : "/sign-up"}>{createAccount ? "Sign in" : "Start free"}</Link></p>
    </section>
  </main>;
}
