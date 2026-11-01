import { afterEach, describe, expect, it, vi } from "vitest";
import { errorCode, logError } from "./log";

afterEach(() => vi.restoreAllMocks());

describe("errorCode", () => {
  it("prefers a string code (Postgres/PostgREST)", () => {
    expect(errorCode({ code: "23505", message: "dup" })).toBe("23505");
  });

  it("falls back to an HTTP status, then the error class name", () => {
    expect(errorCode({ statusCode: 429 })).toBe("429");
    expect(errorCode(new TypeError("x"))).toBe("TypeError");
  });

  it("ignores an empty code and returns a generic marker for odd shapes", () => {
    expect(errorCode({ code: "", name: "Boom" })).toBe("Boom");
    expect(errorCode({})).toBe("error");
    expect(errorCode("a string with PII")).toBe("error");
    expect(errorCode(42)).toBe("error");
  });

  it("is 'unknown' for null/undefined", () => {
    expect(errorCode(null)).toBe("unknown");
    expect(errorCode(undefined)).toBe("unknown");
  });
});

describe("logError", () => {
  it("logs the tag and code, never the message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("[leave] couldn't save", { code: "42501", message: "row for Asha Kumar violates policy" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("[leave] couldn't save [42501]");
    expect(String(spy.mock.calls[0][0])).not.toContain("Asha");
  });

  it("logs just the tag when there is no error object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("[cron] started");
    expect(spy).toHaveBeenCalledWith("[cron] started");
  });
});
