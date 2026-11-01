import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../../test/fake-supabase";

const createAdminClient = vi.hoisted(() => vi.fn());
const webpush = vi.hoisted(() => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("web-push", () => ({ default: webpush }));

type Push = typeof import("./push");
let sendPush: Push["sendPush"];

const G1 = { userId: "g1", role: "guardian" as const };
const G2 = { userId: "g2", role: "guardian" as const };
const S1 = { userId: "st1", role: "staff" as const };
const PAYLOAD = { title: "Leave approved", body: "Your leave request was approved.", url: "/leave" };

const sub = (id: string, owner: { guardian_id?: string; staff_id?: string }) => ({
  id,
  endpoint: `https://push.example/${id}`,
  p256dh: `p-${id}`,
  auth: `a-${id}`,
  guardian_id: null,
  staff_id: null,
  ...owner,
});

function setup(tables: Record<string, Record<string, unknown>[]>) {
  const fake = fakeSupabase({ notification_preferences: [], push_subscriptions: [], ...tables });
  createAdminClient.mockReturnValue(fake.client);
  return fake;
}

beforeEach(async () => {
  vi.resetModules(); // push.ts caches "VAPID configured" at module level
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  vi.stubEnv("VAPID_SUBJECT", "");
  webpush.setVapidDetails.mockReset();
  webpush.sendNotification.mockReset().mockResolvedValue({});
  createAdminClient.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  ({ sendPush } = await import("./push"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendPush — guard rails", () => {
  it("does nothing for an empty target list", async () => {
    await sendPush([], PAYLOAD, "leave");
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("skips quietly (no throw, no DB) when VAPID keys are missing", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.resetModules();
    ({ sendPush } = await import("./push"));
    await sendPush([G1], PAYLOAD, "leave");
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("configures VAPID once with the default contact subject", async () => {
    setup({});
    await sendPush([G1], PAYLOAD, "leave");
    await sendPush([G1], PAYLOAD, "leave");
    expect(webpush.setVapidDetails).toHaveBeenCalledTimes(1);
    expect(webpush.setVapidDetails).toHaveBeenCalledWith("mailto:office@manthanvidyashram.in", "pub", "priv");
  });
});

describe("sendPush — delivery", () => {
  it("sends the JSON payload to every device of every target", async () => {
    const { queries } = setup({
      push_subscriptions: [sub("a", { guardian_id: "g1" }), sub("b", { guardian_id: "g1" }), sub("c", { staff_id: "st1" })],
    });
    await sendPush([G1, S1], PAYLOAD, "leave");

    expect(webpush.sendNotification).toHaveBeenCalledTimes(3);
    const [subscription, body] = webpush.sendNotification.mock.calls[0];
    expect(subscription).toEqual({ endpoint: "https://push.example/a", keys: { p256dh: "p-a", auth: "a-a" } });
    expect(JSON.parse(body)).toEqual(PAYLOAD);

    const subQuery = queries.find((q) => q.table === "push_subscriptions")!;
    expect(subQuery.ops).toContainEqual(["or", "guardian_id.in.(g1),staff_id.in.(st1)"]);
  });

  it("logs one notification_log row per target; delivered if any device succeeded", async () => {
    const { writes } = setup({
      push_subscriptions: [sub("a", { guardian_id: "g1" }), sub("b", { guardian_id: "g1" }), sub("c", { guardian_id: "g2" })],
    });
    webpush.sendNotification.mockImplementation(async (s: { endpoint: string }) => {
      if (s.endpoint.endsWith("/a") || s.endpoint.endsWith("/c")) throw Object.assign(new Error("x"), { statusCode: 500 });
    });
    await sendPush([G1, G2], PAYLOAD, "leave");

    const log = writes.find((w) => w.table === "notification_log")!;
    expect(log.kind).toBe("insert");
    expect(log.payload).toEqual([
      { recipient_type: "guardian", recipient_id: "g1", category: "leave", title: PAYLOAD.title, body: PAYLOAD.body, delivered: true },
      { recipient_type: "guardian", recipient_id: "g2", category: "leave", title: PAYLOAD.title, body: PAYLOAD.body, delivered: false },
    ]);
  });

  it("still writes the audit row for a target with no subscribed device", async () => {
    const { writes } = setup({});
    await sendPush([G1], PAYLOAD, "messages");
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(writes.find((w) => w.table === "notification_log")?.payload).toEqual([
      expect.objectContaining({ recipient_id: "g1", delivered: false }),
    ]);
  });
});

describe("sendPush — school-wide broadcast", () => {
  // Every id travels in the query string (`.or("guardian_id.in.(…)")`). ~1,600 uuids is
  // ~60 KB of URL, which gateways reject; the lookup then fails and, without chunking,
  // nobody is notified. Each lookup must stay small and the results must be combined.
  const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  const N = 1600;
  const everyone = Array.from({ length: N }, (_, i) => ({ userId: uuid(i), role: "guardian" as const }));

  it("keeps every lookup URL small", async () => {
    const { queries } = setup({});
    await sendPush(everyone, PAYLOAD, "messages");
    const ors = queries.flatMap((q) => q.ops).filter((o) => o[0] === "or") as ["or", string][];
    expect(ors.length).toBeGreaterThan(1);
    for (const [, expr] of ors) expect(expr.length).toBeLessThan(6000);
  });

  it("still reaches every subscribed device and logs every recipient", async () => {
    const { writes } = setup({
      push_subscriptions: everyone.map((t, i) => sub(`d${i}`, { guardian_id: t.userId })),
    });
    await sendPush(everyone, PAYLOAD, "messages");
    expect(webpush.sendNotification).toHaveBeenCalledTimes(N);
    const log = writes.find((w) => w.table === "notification_log")!;
    expect(log.payload as unknown[]).toHaveLength(N);
  });

  it("a recipient with several devices is still sent each one exactly once", async () => {
    setup({
      push_subscriptions: [sub("a", { guardian_id: uuid(0) }), sub("b", { guardian_id: uuid(0) })],
    });
    await sendPush(everyone, PAYLOAD, "messages");
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
  });

  it("applies opt-outs across chunks", async () => {
    setup({
      notification_preferences: [uuid(5), uuid(1500)].map((id) => ({ guardian_id: id, staff_id: null, category: "messages", enabled: false })),
      push_subscriptions: [uuid(5), uuid(6), uuid(1500)].map((id, i) => sub(`d${i}`, { guardian_id: id })),
    });
    await sendPush(everyone, PAYLOAD, "messages");
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
  });
});

describe("sendPush — dead and failing subscriptions", () => {
  it.each([404, 410])("prunes a subscription the browser dropped (%i)", async (statusCode) => {
    const { writes } = setup({ push_subscriptions: [sub("gone", { guardian_id: "g1" })] });
    webpush.sendNotification.mockRejectedValue(Object.assign(new Error("gone"), { statusCode }));
    await sendPush([G1], PAYLOAD, "leave");
    expect(writes).toContainEqual({ table: "push_subscriptions", kind: "delete", payload: { id: "gone" } });
  });

  it("keeps the subscription on other failures and logs only a code", async () => {
    const { writes } = setup({ push_subscriptions: [sub("flaky", { guardian_id: "g1" })] });
    webpush.sendNotification.mockRejectedValue(Object.assign(new Error("Asha Kumar's endpoint blew up"), { statusCode: 500 }));
    await sendPush([G1], PAYLOAD, "leave");
    expect(writes.some((w) => w.kind === "delete")).toBe(false);
    const logged = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat().join(" ");
    expect(logged).toContain("[push] send failed");
    expect(logged).not.toContain("Asha");
  });

  it("one failing device does not stop the others", async () => {
    setup({ push_subscriptions: [sub("a", { guardian_id: "g1" }), sub("b", { guardian_id: "g2" })] });
    webpush.sendNotification.mockRejectedValueOnce(new Error("boom"));
    await sendPush([G1, G2], PAYLOAD, "leave");
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
  });

  it("if the subscription lookup fails, nothing is sent but the recipient is logged as not delivered", async () => {
    const broken = fakeSupabase({}, { error: "db down" });
    createAdminClient.mockReturnValue(broken.client);
    await sendPush([G1], PAYLOAD, "leave");
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(broken.writes.find((w) => w.table === "notification_log")?.payload).toEqual([
      expect.objectContaining({ recipient_id: "g1", delivered: false }),
    ]);
    const logged = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat().join(" ");
    expect(logged).toContain("[push] could not read subscriptions");
    expect(logged).not.toContain("db down");
  });
});

describe("sendPush — notification preferences", () => {
  it("drops targets who turned this category off, keeps the rest", async () => {
    const { writes } = setup({
      notification_preferences: [
        { guardian_id: "g1", staff_id: null, category: "leave", enabled: false },
        { guardian_id: "g2", staff_id: null, category: "ptm", enabled: false }, // different category
        { guardian_id: "g2", staff_id: null, category: "leave", enabled: true }, // explicitly on
      ],
      push_subscriptions: [sub("a", { guardian_id: "g2" })],
    });
    await sendPush([G1, G2], PAYLOAD, "leave");
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    const log = writes.find((w) => w.table === "notification_log")!;
    expect((log.payload as { recipient_id: string }[]).map((r) => r.recipient_id)).toEqual(["g2"]);
  });

  it("applies the opt-out to staff separately from guardians with the same id space", async () => {
    setup({
      notification_preferences: [{ guardian_id: null, staff_id: "st1", category: "leave", enabled: false }],
      push_subscriptions: [sub("a", { guardian_id: "g1" })],
    });
    await sendPush([G1, S1], PAYLOAD, "leave");
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("sends nothing and writes no log when everyone opted out", async () => {
    const { writes } = setup({
      notification_preferences: [{ guardian_id: "g1", staff_id: null, category: "leave", enabled: false }],
      push_subscriptions: [sub("a", { guardian_id: "g1" })],
    });
    await sendPush([G1], PAYLOAD, "leave");
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("fails open: if preferences cannot be read, notifications still go out", async () => {
    const real = setup({ push_subscriptions: [sub("a", { guardian_id: "g1" })] });
    createAdminClient.mockReturnValue({
      from: (table: string) =>
        table === "notification_preferences"
          ? { select: () => ({ eq: () => ({ eq: () => ({ or: async () => ({ data: null, error: { code: "XX000", message: "x" } }) }) }) }) }
          : real.from(table),
    });
    await sendPush([G1], PAYLOAD, "leave");
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
  });
});
