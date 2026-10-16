"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { Checkbox } from "@/components/ui/checkbox";
import { DEMO_ACCOUNT, findAccount, MIN_PASSWORD, safeNext, signIn, signOut, useSession } from "@/lib/auth";
import { AuthAlert, AuthCard, AuthField, AuthInput, authLink, EMAIL_RE, PasswordInput, simulate, SubmitButton } from "./auth-ui";

type Errors = { email?: string; password?: string };

export function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState("");
  const [success, setSuccess] = useState(false);

  const validate = (e = email, p = password): Errors => ({
    email: !e.trim() ? "Enter your email address" : !EMAIL_RE.test(e.trim()) ? "Enter a valid email, like name@company.com" : undefined,
    password: !p ? "Enter your password" : undefined,
  });

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    setFailed("");
    const errs = validate();
    setErrors(errs);
    if (errs.email || errs.password) {
      document.getElementById(errs.email ? "login-email" : "login-password")?.focus();
      return;
    }
    setLoading(true);
    await simulate();
    const account = findAccount(email);
    // Only the password's length is looked at; it is then dropped from memory.
    const ok = !!account && password.length >= MIN_PASSWORD;
    setPassword("");
    if (!ok) {
      setLoading(false);
      setFailed(account ? "That email and password don't match." : "We couldn't find an account with that email.");
      document.getElementById("login-password")?.focus();
      return;
    }
    signIn(account, remember);
    setSuccess(true);
    await simulate(500);
    router.replace(next);
  };

  const count = Object.values(errors).filter(Boolean).length;

  if (session && !success)
    return (
      <AuthCard title="You're already signed in" description={`Signed in as ${session.name} (${session.email}).`}>
        <div className="space-y-3">
          <Link href={next} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-campaign-action px-4 text-[14.5px] font-semibold text-white hover:bg-campaign-hover">
            Continue to EVOQ Campaigns <ArrowRightIcon size={16} weight="bold" aria-hidden />
          </Link>
          <button type="button" onClick={signOut} className={`${authLink} block w-full text-center text-[13px]`}>
            Sign in with a different account
          </button>
        </div>
      </AuthCard>
    );

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to continue to EVOQ Campaigns."
      footer={
        <>
          New to EVOQ Campaigns?{" "}
          <Link href="/signup" className={authLink}>
            Create an account
          </Link>
        </>
      }
    >
      {success ? (
        <AuthAlert tone="success" title="Signed in">
          Taking you to your workspace…
        </AuthAlert>
      ) : (
        <form noValidate onSubmit={submit} className="space-y-4">
          {params.get("registered") === "1" && !submitted && (
            <AuthAlert tone="success" title="Account created">
              Sign in with your new account to continue.
            </AuthAlert>
          )}
          {params.get("reset") === "1" && !submitted && (
            <AuthAlert tone="info" title="Check your inbox">
              In a real workspace you&apos;d now follow the reset link. In this demo, sign in with any password of {MIN_PASSWORD}+ characters.
            </AuthAlert>
          )}
          {submitted && count > 0 && <AuthAlert tone="error" title={count === 1 ? "1 field needs attention" : `${count} fields need attention`} />}
          {failed && (
            <AuthAlert tone="error" title="Couldn't sign you in">
              {failed} This is a simulated check.
            </AuthAlert>
          )}
          <AuthField id="login-email" label="Email address" required error={errors.email}>
            <AuthInput
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@company.com"
              value={email}
              invalid={!!errors.email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (submitted) setErrors(validate(e.target.value, password));
              }}
            />
          </AuthField>
          <AuthField
            id="login-password"
            label="Password"
            required
            error={errors.password}
            aside={
              <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} className={`${authLink} text-[12.5px]`}>
                Forgot password?
              </Link>
            }
          >
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              value={password}
              invalid={!!errors.password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (submitted) setErrors(validate(email, e.target.value));
              }}
            />
          </AuthField>
          <label className="flex items-center gap-2 text-[13px] text-ink-body">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} /> Remember me
            <span className="text-[12px] text-ink-muted">· stay signed in after closing the tab</span>
          </label>
          <SubmitButton loading={loading} loadingLabel="Signing in…">
            Sign In
          </SubmitButton>
          <AuthAlert tone="info" title="Demo sign-in">
            Use{" "}
            <button type="button" className={authLink} onClick={() => (setEmail(DEMO_ACCOUNT.email), setErrors({}))}>
              {DEMO_ACCOUNT.email}
            </button>{" "}
            (or an account you created) and any password of {MIN_PASSWORD}+ characters. Shorter passwords show the error state.
          </AuthAlert>
        </form>
      )}
    </AuthCard>
  );
}
