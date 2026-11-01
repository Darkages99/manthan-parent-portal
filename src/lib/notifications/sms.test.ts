import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSmsRelay } from "./sms";

const PHONE = "+919876543210";
const BODY = "Your child Asha is unwell, please collect her";

beforeEach(() => {
  vi.stubEnv("SMS_GATEWAY_URL", "");
  vi.stubEnv("SMS_GATEWAY_TOKEN", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getSmsRelay without configuration", () => {
  it("does not send and reports it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await getSmsRelay().send(PHONE, BODY)).toEqual({ ok: false, error: "SMS relay not configured" });
  });

  it("never writes the recipient's number or the message text to the log (DG-4)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await getSmsRelay().send(PHONE, BODY);
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).not.toContain("9876543210");
    expect(logged).not.toContain("Asha");
  });

  it("needs both the URL and the token", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("SMS_GATEWAY_URL", "https://relay.local");
    expect((await getSmsRelay().send(PHONE, BODY)).ok).toBe(false);
  });
});

describe("getSmsRelay with a gateway configured", () => {
  beforeEach(() => {
    vi.stubEnv("SMS_GATEWAY_URL", "https://relay.local");
    vi.stubEnv("SMS_GATEWAY_TOKEN", "tok");
  });

  it("POSTs the number and message with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    expect(await getSmsRelay().send(PHONE, BODY)).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://relay.local/message");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ phoneNumbers: [PHONE], message: BODY });
  });

  it("reports a non-2xx response without echoing the body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    expect(await getSmsRelay().send(PHONE, BODY)).toEqual({ ok: false, error: "relay returned 503" });
  });

  it("turns a network failure into a result instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await getSmsRelay().send(PHONE, BODY)).toEqual({ ok: false, error: "ECONNREFUSED" });
  });
});
