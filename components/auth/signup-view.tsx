"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { findAccount, registerAccount } from "@/lib/auth";
import { AuthAlert, AuthCard, AuthField, AuthInput, authLink, EMAIL_RE, PASSWORD_RULES, PasswordInput, PasswordRules, simulate, SubmitButton } from "./auth-ui";

type Field = "name" | "email" | "company" | "password" | "confirm" | "terms";
type Errors = Partial<Record<Field, string>>;
const ORDER: Field[] = ["name", "email", "company", "password", "confirm", "terms"];
const FREE_MAIL = /@(gmail|yahoo|hotmail|outlook|icloud|aol|proton)\./i;

export function SignupView() {
  const router = useRouter();
  const [v, setV] = useState({ name: "", email: "", company: "", password: "", confirm: "", terms: false });
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const validate = (x = v): Errors => ({
    name: x.name.trim().length < 2 ? "Enter your full name" : undefined,
    email: !x.email.trim() ? "Enter your work email" : !EMAIL_RE.test(x.email.trim()) ? "Enter a valid email, like name@company.com" : findAccount(x.email) ? "An account with this email already exists — sign in instead" : undefined,
    company: x.company.trim().length < 2 ? "Enter your company name" : undefined,
    password: !x.password ? "Create a password" : PASSWORD_RULES.every((r) => r.test(x.password)) ? undefined : "Your password doesn't meet all the requirements",
    confirm: !x.confirm ? "Confirm your password" : x.confirm !== x.password ? "Passwords don't match" : undefined,
    terms: x.terms ? undefined : "Accept the terms to create an account",
  });

  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => {
    const next = { ...v, [k]: val };
    setV(next);
    if (submitted) setErrors(validate(next));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate();
    setErrors(errs);
    const first = ORDER.find((f) => errs[f]);
    if (first) {
      document.getElementById(`signup-${first}`)?.focus();
      return;
    }
    setLoading(true);
    await simulate(1100);
    registerAccount({ name: v.name, email: v.email, company: v.company });
    // Passwords are never kept.
    setV({ ...v, password: "", confirm: "" });
    setLoading(false);
    setDone(true);
    await simulate(1400);
    router.replace(`/login?registered=1&email=${encodeURIComponent(v.email.trim().toLowerCase())}`);
  };

  const count = Object.values(errors).filter(Boolean).length;
  const workEmailHint = v.email && FREE_MAIL.test(v.email) ? "Tip: a work address helps your emails reach inboxes." : undefined;

  return (
    <AuthCard
      title="Create your account"
      description="Start sending email, SMS and WhatsApp campaigns in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className={authLink}>
            Sign in
          </Link>
        </>
      }
    >
      {done ? (
        <AuthAlert tone="success" title="Account created">
          Welcome aboard, {v.name.split(" ")[0]}! Taking you to sign in… (simulated — no real account was created on a server).
        </AuthAlert>
      ) : (
        <form noValidate onSubmit={submit} className="space-y-4">
          {submitted && count > 0 && <AuthAlert tone="error" title={count === 1 ? "1 field needs attention" : `${count} fields need attention`} />}
          <AuthField id="signup-name" label="Full name" required error={errors.name}>
            <AuthInput id="signup-name" autoComplete="name" value={v.name} invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} placeholder="Alex Morgan" />
          </AuthField>
          <AuthField id="signup-email" label="Work email" required error={errors.email} hint={workEmailHint}>
            <AuthInput id="signup-email" type="email" autoComplete="email" inputMode="email" value={v.email} invalid={!!errors.email} onChange={(e) => set("email", e.target.value)} placeholder="name@company.com" />
          </AuthField>
          <AuthField id="signup-company" label="Company name" required error={errors.company}>
            <AuthInput id="signup-company" autoComplete="organization" value={v.company} invalid={!!errors.company} onChange={(e) => set("company", e.target.value)} placeholder="Northwind Traders" />
          </AuthField>
          <AuthField id="signup-password" label="Password" required error={errors.password} hint={<PasswordRules value={v.password} />}>
            <PasswordInput id="signup-password" autoComplete="new-password" value={v.password} invalid={!!errors.password} onChange={(e) => set("password", e.target.value)} />
          </AuthField>
          {errors.password && <PasswordRules value={v.password} />}
          <AuthField id="signup-confirm" label="Confirm password" required error={errors.confirm}>
            <PasswordInput id="signup-confirm" autoComplete="new-password" value={v.confirm} invalid={!!errors.confirm} onChange={(e) => set("confirm", e.target.value)} />
          </AuthField>
          <div>
            <label className="flex items-start gap-2 text-[13px] leading-5 text-ink-body">
              <Checkbox id="signup-terms" checked={v.terms} onCheckedChange={(c) => set("terms", c === true)} aria-invalid={errors.terms ? true : undefined} aria-describedby={errors.terms ? "signup-terms-error" : undefined} className="mt-0.5" />
              <span>
                I agree to the <span className="font-medium text-campaign-action">Terms of Service</span> and <span className="font-medium text-campaign-action">Privacy Policy</span>.<span className="ml-0.5 text-[#E5484D]" aria-hidden>*</span>
              </span>
            </label>
            {errors.terms && (
              <p id="signup-terms-error" className="mt-1 text-[12px] font-medium text-[#D92D20]">
                {errors.terms}
              </p>
            )}
          </div>
          <SubmitButton loading={loading} loadingLabel="Creating your account…">
            Sign Up
          </SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
