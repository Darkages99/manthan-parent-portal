/**
 * SMS fallback, kept free of a paid gateway.
 *
 * The practical zero-cost route for a single school is an "Android phone as
 * SMS gateway": a dedicated Android device (with a SIM on a normal calling
 * plan) runs a small relay app — e.g. the open-source android-sms-gateway
 * (https://github.com/android-sms-gateway) or a self-hosted equivalent —
 * that exposes a local/cloud HTTP endpoint. This server calls that endpoint;
 * the phone sends the SMS through its own SIM, so the marginal cost per
 * message is whatever the school's mobile plan already charges (commonly
 * bundled/free) rather than a per-message gateway fee.
 *
 * This file defines the interface the rest of the app codes against, so
 * swapping in the real relay later — or a paid gateway, if the school ever
 * wants one — is a one-file change.
 */

export interface SmsRelay {
  send(toE164: string, message: string): Promise<{ ok: boolean; error?: string }>;
}

/** No relay configured yet — logs instead of sending, so nothing throws in dev. */
class NoopSmsRelay implements SmsRelay {
  async send(toE164: string, message: string) {
    console.warn(
      `[sms] no relay configured — would have sent to ${toE164}: "${message}". ` +
        `Set SMS_GATEWAY_URL + SMS_GATEWAY_TOKEN once the Android relay phone is set up.`
    );
    return { ok: false, error: "SMS relay not configured" };
  }
}

/** Android-phone relay (android-sms-gateway style: POST /message with Basic auth). */
class AndroidGatewaySmsRelay implements SmsRelay {
  constructor(private baseUrl: string, private token: string) {}

  async send(toE164: string, message: string) {
    try {
      const res = await fetch(`${this.baseUrl}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ phoneNumbers: [toE164], message }),
      });
      if (!res.ok) return { ok: false, error: `relay returned ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}

export function getSmsRelay(): SmsRelay {
  const url = process.env.SMS_GATEWAY_URL;
  const token = process.env.SMS_GATEWAY_TOKEN;
  if (url && token) return new AndroidGatewaySmsRelay(url, token);
  return new NoopSmsRelay();
}
