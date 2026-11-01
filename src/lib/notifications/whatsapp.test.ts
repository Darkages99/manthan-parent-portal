import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWhatsAppLink, openWhatsApp } from "./whatsapp";

afterEach(() => vi.unstubAllGlobals());

describe("buildWhatsAppLink", () => {
  it("keeps digits only in the number and URL-encodes the message", () => {
    expect(buildWhatsAppLink("+91 98765-43210", "Hi & bye?")).toBe("https://wa.me/919876543210?text=Hi%20%26%20bye%3F");
  });

  it("encodes newlines and non-ASCII text", () => {
    expect(buildWhatsAppLink("+911", "a\nb ₹")).toBe("https://wa.me/911?text=a%0Ab%20%E2%82%B9");
  });
});

describe("openWhatsApp", () => {
  it("is a no-op on the server (no window)", () => {
    expect(() => openWhatsApp("+911", "x")).not.toThrow();
  });

  it("opens the link in a new tab without leaking the opener", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    openWhatsApp("+911", "x");
    expect(open).toHaveBeenCalledWith("https://wa.me/911?text=x", "_blank", "noopener,noreferrer");
  });
});
