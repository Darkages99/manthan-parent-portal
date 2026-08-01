"use client";

import { useEffect, useState } from "react";
import { BellIcon } from "./icons";
import { savePushSubscription, deletePushSubscription } from "@/app/actions/push";

/** VAPID public keys are base64url; PushManager wants a Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type State = "loading" | "unsupported" | "off" | "on" | "denied" | "busy";

/** Sidebar control to opt in/out of browser push notifications. Renders nothing
 * when push isn't configured (no VAPID key) or supported by the browser. */
export function PushToggle({ collapsed = false }: { collapsed?: boolean }) {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!vapidKey || typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  async function enable() {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey!) as BufferSource,
      });
      await savePushSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      setState("on");
    } catch (err) {
      console.error("[push] subscribe failed", err);
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch (err) {
      console.error("[push] unsubscribe failed", err);
      setState("on");
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  const on = state === "on";
  const disabled = state === "busy" || state === "denied";
  const label =
    state === "denied"
      ? "Notifications blocked"
      : on
        ? "Notifications on"
        : "Enable notifications";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={on ? disable : enable}
        disabled={disabled}
        title={label}
        aria-label={label}
        aria-pressed={on}
        className={`rounded-sm p-1.5 hover:bg-mist disabled:opacity-50 ${on ? "text-maroon" : "text-slate"}`}
      >
        <BellIcon className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={on ? disable : enable}
      disabled={disabled}
      aria-pressed={on}
      className={`flex w-full items-center gap-2 rounded-sm px-1 py-1.5 text-left text-sm transition hover:bg-mist disabled:opacity-50 ${
        on ? "text-maroon" : "text-slate"
      }`}
    >
      <BellIcon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      {on && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />}
    </button>
  );
}
