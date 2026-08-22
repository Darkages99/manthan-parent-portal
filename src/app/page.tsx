"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mandala } from "@/components/mandala";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

type Method = "password" | "otp" | "google";

const TABS: { id: Method; label: string }[] = [
  { id: "password", label: "Email" },
  { id: "otp", label: "Phone" },
  { id: "google", label: "Google" },
];

const inputClass =
  "rounded-lg border border-cream/25 bg-cream/10 px-3.5 py-2.5 text-base text-cream placeholder:text-cream/40 transition focus:border-cream/70 focus:bg-cream/15 focus:outline-none";

const primaryButtonClass =
  "mt-1 rounded-lg bg-cream px-5 py-3 text-center text-base font-semibold text-[#5a0510] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.04 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.19a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.43-4.96 3.43-8.48Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.36 1.1-3.9 1.1-3 0-5.54-2.03-6.45-4.75H1.71v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.71a11.5 11.5 0 0 0 0 10.3l3.84-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.08c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.64 15.1.5 12 .5A11.5 11.5 0 0 0 1.71 6.85l3.84 2.98C6.46 7.11 9 5.08 12 5.08Z"
      />
    </svg>
  );
}

export default function Landing() {
  return (
    <Suspense fallback={<LandingFallback />}>
      <LandingForm />
    </Suspense>
  );
}

// Static shell shown while `useSearchParams` resolves (only reads the `?error`
// query param appended after a failed OAuth redirect) — keeps the initial HTML
// prerenderable per the Missing Suspense boundary requirement for
// useSearchParams in a Client Component (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md).
function LandingFallback() {
  return (
    <div className="relative isolate flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden bg-maroon px-6 py-[clamp(2rem,6vh,5rem)] text-cream" />
  );
}

function LandingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  const [method, setMethod] = useState<Method>("password");

  // Email + password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Phone + OTP
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);

  // Google
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPasswordLoading(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    router.push("/post-login");
    router.refresh();
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setOtpLoading(false);
    if (error) {
      setOtpError(error.message);
      return;
    }
    setOtpSent(true);
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    setOtpLoading(false);
    if (error) {
      setOtpError(error.message);
      return;
    }
    router.push("/post-login");
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setGoogleError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setGoogleLoading(false);
      setGoogleError(error.message);
    }
    // On success the browser is redirected away by Supabase — no further handling needed here.
  }

  return (
    <div
      className="relative isolate flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden bg-maroon px-6 py-[clamp(2rem,6vh,5rem)] text-cream"
      style={{ ["--mandala-ink" as string]: "#f7efe1", ["--mandala-strength" as string]: "0.06" }}
    >
      {/* Ambient rangoli — one large slow-turning motif centered behind the card. */}
      <Mandala size="min(150vh, 150vw, 60rem)" className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" spin />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(120% 90% at 50% 30%, transparent 40%, rgba(0,0,0,0.28) 100%)" }}
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <Image
          src="/brand/icon-192.png"
          alt="Manthan Vidyashram"
          width={92}
          height={92}
          className="rounded-full shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)] ring-2 ring-cream/25"
          priority
        />
        <p className="mt-6 font-heading text-sm uppercase tracking-[0.24em] text-cream/80">
          Manthan Vidyashram
        </p>
        <h1 className="mt-2 text-center font-heading text-[clamp(2.25rem,7vw,3.25rem)] leading-none text-balance">
          Parent Portal
        </h1>

        <div className="mt-9 w-full rounded-2xl border border-cream/15 bg-[rgba(0,0,0,0.16)] p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-[2px]">
          <div className="flex gap-1 rounded-lg border border-cream/15 bg-[rgba(0,0,0,0.18)] p-1" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={method === tab.id}
                onClick={() => setMethod(tab.id)}
                className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition ${
                  method === tab.id
                    ? "bg-cream text-[#5a0510] shadow-sm"
                    : "text-cream/70 hover:text-cream"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {oauthError && (
            <p
              className="mt-3.5 rounded-lg border border-cream/20 bg-[rgba(0,0,0,0.22)] px-3 py-2 text-sm text-cream"
              role="alert"
            >
              Sign-in failed. Please try again.
            </p>
          )}

          {method === "password" && (
            <form onSubmit={handlePasswordSubmit} className="mt-3.5 flex w-full flex-col gap-3.5">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-cream/85">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-cream/85">Password</span>
                <span className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className={`w-full pr-11 ${inputClass}`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-2.5 flex h-7 w-7 items-center justify-center rounded-md text-cream/60 transition hover:text-cream focus-visible:outline-2 focus-visible:outline-cream/70"
                  >
                    {showPassword ? <EyeOffIcon className="h-4.5 w-4.5" /> : <EyeIcon className="h-4.5 w-4.5" />}
                  </button>
                </span>
              </label>

              {passwordError && (
                <p className="rounded-lg border border-cream/20 bg-[rgba(0,0,0,0.22)] px-3 py-2 text-sm text-cream" role="alert">
                  {passwordError}
                </p>
              )}

              <button type="submit" disabled={passwordLoading} className={primaryButtonClass}>
                {passwordLoading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}

          {method === "otp" && (
            <form
              onSubmit={otpSent ? handleVerifyCode : handleSendCode}
              className="mt-3.5 flex w-full flex-col gap-3.5"
            >
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-cream/85">Phone number</span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  disabled={otpSent}
                  className={`${inputClass} disabled:opacity-60`}
                  placeholder="+91 98765 43210"
                />
              </label>

              {otpSent && (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-cream/85">6-digit code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="one-time-code"
                    className={inputClass}
                    placeholder="123456"
                  />
                </label>
              )}

              {otpError && (
                <p className="rounded-lg border border-cream/20 bg-[rgba(0,0,0,0.22)] px-3 py-2 text-sm text-cream" role="alert">
                  {otpError}
                </p>
              )}

              <button type="submit" disabled={otpLoading} className={primaryButtonClass}>
                {otpLoading ? "Please wait…" : otpSent ? "Verify code" : "Send code"}
              </button>

              {otpSent && (
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setCode("");
                    setOtpError(null);
                  }}
                  className="text-center text-sm text-cream/70 underline-offset-2 transition hover:text-cream hover:underline"
                >
                  Use a different number
                </button>
              )}
            </form>
          )}

          {method === "google" && (
            <div className="mt-3.5 flex w-full flex-col gap-3.5">
              {googleError && (
                <p className="rounded-lg border border-cream/20 bg-[rgba(0,0,0,0.22)] px-3 py-2 text-sm text-cream" role="alert">
                  {googleError}
                </p>
              )}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className={`${primaryButtonClass} flex items-center justify-center gap-2.5`}
              >
                <GoogleGlyph />
                {googleLoading ? "Redirecting…" : "Continue with Google"}
              </button>
            </div>
          )}
        </div>

        <p className="mt-7 max-w-xs text-center text-sm leading-relaxed text-cream/70">
          Accounts are set up by the school. Contact the front office if you don&apos;t have a
          login yet.
        </p>
      </div>
    </div>
  );
}
