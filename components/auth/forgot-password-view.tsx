"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import { AuthAlert, AuthCard, AuthField, AuthInput, authLink, EMAIL_RE, simulate, SubmitButton } from "./auth-ui";

export function ForgotPasswordView() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const check = (e: string) => (!e.trim() ? "Enter the email you sign in with" : !EMAIL_RE.test(e.trim()) ? "Enter a valid email, like name@company.com" : "");

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    const err = check(email);
    setError(err);
    if (err) return document.getElementById("forgot-email")?.focus();
    setLoading(true);
    await simulate();
    setLoading(false);
    // Same message whether or not the account exists, as a real service would.
    setSentTo(email.trim());
  };

  return (
    <AuthCard
      title="Forgot password"
      description="Enter the email you sign in with and we'll send you a link to reset your password."
      footer={
        <Link href="/login" className={`${authLink} inline-flex items-center gap-1.5`}>
          <ArrowLeftIcon size={14} aria-hidden /> Back to Login
        </Link>
      }
    >
      {sentTo ? (
        <div className="space-y-4">
          <AuthAlert tone="success" title="Reset link sent">
            If an account exists for <span className="font-medium text-ink">{sentTo}</span>, a reset link is on its way. It expires in 30 minutes.
          </AuthAlert>
          <AuthAlert tone="info" title="Demo only">
            No email was actually sent. Return to sign in and use any password of 8+ characters.
          </AuthAlert>
          <Link href={`/login?reset=1&email=${encodeURIComponent(sentTo)}`} className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-campaign-action px-4 text-[14.5px] font-semibold text-white hover:bg-campaign-hover">
            Return to sign in
          </Link>
          <button type="button" onClick={() => setSentTo("")} className={`${authLink} block w-full text-center text-[13px]`}>
            Use a different email
          </button>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="space-y-4">
          <AuthField id="forgot-email" label="Email address" required error={error}>
            <AuthInput
              id="forgot-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@company.com"
              value={email}
              invalid={!!error}
              onChange={(e) => {
                setEmail(e.target.value);
                if (submitted) setError(check(e.target.value));
              }}
            />
          </AuthField>
          <SubmitButton loading={loading} loadingLabel="Sending link…">
            Send Reset Link
          </SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
