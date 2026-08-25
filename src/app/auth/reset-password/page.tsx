"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mandala } from "@/components/mandala";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "rounded-lg border border-cream/25 bg-cream/10 px-3.5 py-2.5 text-base text-cream placeholder:text-cream/40 transition focus:border-cream/70 focus:bg-cream/15 focus:outline-none";

const primaryButtonClass =
  "mt-1 rounded-lg bg-cream px-5 py-3 text-center text-base font-semibold text-[#5a0510] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

/**
 * Landed on after clicking the "reset your password" link Supabase emails.
 * The browser client auto-detects the recovery code in the URL and
 * establishes a session (createBrowserClient defaults to detectSessionInUrl:
 * true), so this page just needs to collect the new password and call
 * updateUser — no manual code exchange required.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/post-login");
      router.refresh();
    }, 1200);
  }

  return (
    <div
      className="relative isolate flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden bg-maroon px-6 py-[clamp(2rem,6vh,5rem)] text-cream"
      style={{ ["--mandala-ink" as string]: "#f7efe1", ["--mandala-strength" as string]: "0.06" }}
    >
      <Mandala size="min(150vh, 150vw, 60rem)" className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" spin />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(0,0,0,0.28) 100%)" }}
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <p className="font-heading text-sm uppercase tracking-[0.24em] text-cream/80">Manthan Vidyashram</p>
        <h1 className="mt-2 text-center font-heading text-[clamp(1.75rem,6vw,2.5rem)] leading-tight text-balance">
          Set a new password
        </h1>

        <div className="mt-7 w-full rounded-2xl border border-cream/15 bg-[rgba(0,0,0,0.16)] p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-[2px]">
          {done ? (
            <p className="text-center text-base text-cream">Password updated — signing you in…</p>
          ) : (
            <form onSubmit={onSubmit} className="flex w-full flex-col gap-3.5">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-cream/85">New password</span>
                <span className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className={`w-full pr-11 ${inputClass}`}
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2.5 flex h-7 w-7 items-center justify-center rounded-md text-cream/60 transition hover:text-cream"
                  >
                    {showPassword ? <EyeOffIcon className="h-4.5 w-4.5" /> : <EyeIcon className="h-4.5 w-4.5" />}
                  </button>
                </span>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-cream/85">Confirm password</span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className={inputClass}
                  placeholder="Repeat password"
                />
              </label>

              {error && (
                <p className="rounded-lg border border-cream/20 bg-[rgba(0,0,0,0.22)] px-3 py-2 text-sm text-cream" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className={primaryButtonClass}>
                {loading ? "Saving…" : "Save new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
