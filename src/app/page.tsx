"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mandala } from "@/components/mandala";
import { createClient } from "@/lib/supabase/client";

export default function Landing() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/home");
    router.refresh();
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

        <form
          onSubmit={handleSubmit}
          className="mt-9 flex w-full flex-col gap-3.5 rounded-2xl border border-cream/15 bg-[rgba(0,0,0,0.16)] p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-[2px]"
        >
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-cream/85">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="rounded-lg border border-cream/25 bg-cream/10 px-3.5 py-2.5 text-base text-cream placeholder:text-cream/40 transition focus:border-cream/70 focus:bg-cream/15 focus:outline-none"
              placeholder="you@example.com"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-cream/85">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="rounded-lg border border-cream/25 bg-cream/10 px-3.5 py-2.5 text-base text-cream placeholder:text-cream/40 transition focus:border-cream/70 focus:bg-cream/15 focus:outline-none"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-cream/20 bg-[rgba(0,0,0,0.22)] px-3 py-2 text-sm text-cream" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-cream px-5 py-3 text-center text-base font-semibold text-[#5a0510] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-7 max-w-xs text-center text-sm leading-relaxed text-cream/70">
          Accounts are set up by the school. Contact the front office if you don&apos;t have a
          login yet.
        </p>
      </div>
    </div>
  );
}
