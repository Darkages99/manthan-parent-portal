import { test, expect } from "@playwright/test";

// Protected routes — any of these should bounce an unauthenticated visitor back
// to the sign-in landing page (guarded in the (parent)/(staff) layouts).
const PROTECTED_ROUTES = ["/home", "/attendance", "/messages", "/console"];

test.describe("sign-in landing", () => {
  test("renders the sign-in form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Parent Portal" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});

test.describe("auth guards", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`redirects anonymous visitor away from ${route}`, async ({ page }) => {
      await page.goto(route);
      // Landed back on the public sign-in page, not the protected content.
      await expect(page).toHaveURL("/");
      await expect(page.getByRole("heading", { name: "Parent Portal" })).toBeVisible();
    });
  }
});
