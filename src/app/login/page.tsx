"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Site Tool Tracker</h1>
      <p className="text-sm text-zinc-600">EX-4002 QEII Halifax Infirmary Expansion</p>
      <form action={action} className="flex flex-col gap-3">
        <input
          name="email"
          autoComplete="username"
          placeholder="Email"
          required
          className="input"
        />
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          required
          className="input"
        />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className="btn-primary">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
