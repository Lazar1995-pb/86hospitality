"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const intent = String(formData.get("intent") ?? "signin");
    const supabase = getSupabaseBrowserClient();

    if (intent === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      setIsSubmitting(false);

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.push("/invoices");
        router.refresh();
        return;
      }

      setMessage("Account created. Check your email if confirmation is required.");
      return;
    }

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
          <strong>Authentication failed.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {message ? <div className="empty-state">{message}</div> : null}

      <label>
        Email
        <input name="email" required type="email" />
      </label>

      <label>
        Password
        <input minLength={6} name="password" required type="password" />
      </label>

      <div className="form-section-header">
        <button
          className="button"
          disabled={isSubmitting}
          name="intent"
          type="submit"
          value="signin"
        >
          {isSubmitting ? "Please wait..." : "Sign in"}
        </button>
        <button
          className="button secondary"
          disabled={isSubmitting}
          name="intent"
          type="submit"
          value="signup"
        >
          Sign up
        </button>
      </div>
    </form>
  );
}
