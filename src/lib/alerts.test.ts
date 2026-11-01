import { afterEach, describe, expect, it, vi } from "vitest";
import { readReportCardSeen, reportCardSeenKey, reportCardSignature, writeReportCardSeen } from "./alerts";

afterEach(() => vi.unstubAllGlobals());

function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  return store;
}

describe("reportCardSignature", () => {
  it("is independent of order and ignores empty entries", () => {
    expect(reportCardSignature(["b.pdf", null, "a.pdf", undefined, ""])).toBe("a.pdf|b.pdf");
    expect(reportCardSignature(["a.pdf", "b.pdf"])).toBe(reportCardSignature(["b.pdf", "a.pdf"]));
  });

  it("changes when a new card is published, so the alert reappears", () => {
    expect(reportCardSignature(["a.pdf"])).not.toBe(reportCardSignature(["a.pdf", "b.pdf"]));
  });

  it("is empty when nothing is published", () => {
    expect(reportCardSignature([])).toBe("");
    expect(reportCardSignature([null])).toBe("");
  });
});

describe("report-card acknowledgement storage", () => {
  it("namespaces the key per student", () => {
    expect(reportCardSeenKey("abc")).toBe("mv-rc-seen:abc");
  });

  it("round-trips a signature", () => {
    stubStorage();
    expect(readReportCardSeen("s1")).toBeNull();
    writeReportCardSeen("s1", "a.pdf|b.pdf");
    expect(readReportCardSeen("s1")).toBe("a.pdf|b.pdf");
    expect(readReportCardSeen("s2")).toBeNull();
  });

  it("never stores an empty signature", () => {
    const store = stubStorage();
    writeReportCardSeen("s1", "");
    expect(store.size).toBe(0);
  });

  it("survives storage being unavailable (private mode)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(readReportCardSeen("s1")).toBeNull();
    expect(() => writeReportCardSeen("s1", "x")).not.toThrow();
  });
});
