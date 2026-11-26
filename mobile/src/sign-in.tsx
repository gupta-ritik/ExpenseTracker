import { useState } from "react";
import { auth } from "./auth";
import { errorMessage } from "./api";
import { Button, Field, Label, Screen, Title, Heading } from "./ui";

export function SignIn({ onSuccess }: { onSuccess: () => void }) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setPending(true);
    setError("");
    try {
      const credentials = { email: email.trim(), password };
      const result = signup
        ? await auth.signUp.email({ ...credentials, name: name.trim() })
        : await auth.signIn.email(credentials);
      if (result.error)
        setError(result.error.message ?? "Authentication failed.");
      else onSuccess();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen>
      <Title>Expense Tracker</Title>
      <Heading>{signup ? "Create account" : "Sign in"}</Heading>
      {signup && (
        <Field
          accessibilityLabel="Name"
          placeholder="Name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />
      )}
      <Field
        accessibilityLabel="Email"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Field
        accessibilityLabel="Password"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        autoComplete={signup ? "new-password" : "current-password"}
        secureTextEntry
      />
      {!!error && <Label error>{error}</Label>}
      <Button
        selected
        disabled={
          pending || !email.trim() || !password || (signup && !name.trim())
        }
        onPress={() => void submit()}
      >
        {pending ? "PLEASE WAIT…" : signup ? "SIGN UP" : "SIGN IN"}
      </Button>
      <Button
        disabled={pending}
        onPress={() => {
          setSignup(!signup);
          setError("");
        }}
      >
        {signup ? "BACK TO SIGN IN" : "CREATE ACCOUNT"}
      </Button>
    </Screen>
  );
}
