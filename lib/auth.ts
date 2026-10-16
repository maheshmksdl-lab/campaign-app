/**
 * Mock authentication for the frontend demo — there is no auth server.
 *
 * - A "session" is only { name, email, company, signedInAt }: passwords are
 *   never stored anywhere (they live in component state and are dropped).
 * - "Remember me" keeps the session in localStorage; otherwise it lives in
 *   sessionStorage, which survives a refresh but ends with the tab.
 * - Sign up records the account's name / email / company (no password) so
 *   the demo can tell known and unknown emails apart on sign in.
 *
 * The app shell checks the session on the client and sends signed-out
 * visitors to /login; nothing here is a security boundary.
 */
import { useSyncExternalStore } from "react";
import { CURRENT_USER } from "@/lib/mock-data/campaigns";

export interface MockSession {
  name: string;
  email: string;
  company?: string;
  signedInAt: string;
}

export interface MockAccount {
  name: string;
  email: string;
  company?: string;
}

const SESSION_KEY = "evoq-campaigns:session";
const ACCOUNTS_KEY = "evoq-campaigns:accounts";

/** Built-in demo account, matching the sample data's user. */
export const DEMO_ACCOUNT: MockAccount = { name: CURRENT_USER.name, email: CURRENT_USER.email, company: CURRENT_USER.org };
/** Shortest password the demo accepts (only its length is ever looked at). */
export const MIN_PASSWORD = 8;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function store(area: "local" | "session"): Storage | null {
  try {
    return area === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

let cached: { raw: string | null; value: MockSession | null } = { raw: null, value: null };

function readSession(): MockSession | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = store("local")?.getItem(SESSION_KEY) ?? store("session")?.getItem(SESSION_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw === cached.raw) return cached.value;
  let value: MockSession | null = null;
  try {
    const v = raw ? (JSON.parse(raw) as MockSession) : null;
    value = v && typeof v.email === "string" && typeof v.name === "string" ? v : null;
  } catch {
    value = null;
  }
  cached = { raw, value };
  return value;
}

export function signIn(account: MockAccount, remember: boolean) {
  const session: MockSession = { name: account.name, email: account.email, company: account.company, signedInAt: new Date().toISOString() };
  try {
    store(remember ? "session" : "local")?.removeItem(SESSION_KEY);
    store(remember ? "local" : "session")?.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage blocked: the session lasts for this page view only.
    cached = { raw: JSON.stringify(session), value: session };
  }
  emit();
  return session;
}

export function signOut() {
  try {
    store("local")?.removeItem(SESSION_KEY);
    store("session")?.removeItem(SESSION_KEY);
  } catch {
    // Nothing to remove.
  }
  cached = { raw: null, value: null };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === SESSION_KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** The signed-in demo user, or null. Always null during SSR. */
export function useSession(): MockSession | null {
  return useSyncExternalStore(subscribe, readSession, () => null);
}

// ── Demo accounts (no passwords) ─────────────────────────────────────

export function accounts(): MockAccount[] {
  try {
    const raw = store("local")?.getItem(ACCOUNTS_KEY);
    const list = raw ? (JSON.parse(raw) as MockAccount[]) : [];
    return [DEMO_ACCOUNT, ...(Array.isArray(list) ? list.filter((a) => a && typeof a.email === "string") : [])];
  } catch {
    return [DEMO_ACCOUNT];
  }
}

export const findAccount = (email: string) => accounts().find((a) => a.email.toLowerCase() === email.trim().toLowerCase());

export function registerAccount(a: MockAccount) {
  const mine = accounts().slice(1);
  try {
    store("local")?.setItem(ACCOUNTS_KEY, JSON.stringify([...mine, { name: a.name.trim(), email: a.email.trim().toLowerCase(), company: a.company?.trim() || undefined }]));
  } catch {
    // Storage blocked: the account can't be remembered.
  }
}

/** Only same-site paths are allowed as a post-login destination. */
export const safeNext = (next: string | null | undefined) => (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/dashboard");
