"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const supabase = getSupabaseBrowserClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (loginError) {
      setError(loginError.message);
      return;
    }

    router.push("/invoices");
    router.refresh();
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      {error ? (
        <div className="error-state">
          <strong>Login failed.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <label>
        Email
        <input name="email" required type="email" />
      </label>

      <label>
        Password
        <input name="password" required type="password" />
      </label>

      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}
