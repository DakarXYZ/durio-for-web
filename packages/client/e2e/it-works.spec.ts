import { expect, test } from "@playwright/test";

import API_ROOT from "./api-root.json" with { type: "json" };

// dur.io has no default server: an instance is reached by its host, here a stub of one
// (api-root.json: GET / of a dur.io API)
const HOST = "durio.test";

test.beforeEach(async ({ page }) => {
  await page.route(`https://${HOST}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const json =
      path === "/.well-known/stoat"
        ? { api: `https://${HOST}/api` }
        : path === "/api" || path === "/api/"
          ? API_ROOT
          : undefined;

    return json
      ? route.fulfill({
          json,
          headers: { "Access-Control-Allow-Origin": "*" },
        })
      : route.abort();
  });
});

test("asks for a server address first", async ({ page }) => {
  await page.goto("");
  await expect(page).toHaveTitle(/dur.io/);
  await expect(page).toHaveURL(/\/connect$/);
  await expect(page.locator("#server-address")).toBeVisible();
});

test("shows a working login page", async ({ page }) => {
  await page.goto(`/i/${HOST}/login`);

  const form = page.locator("form");
  await expect(form.locator('mdui-text-field[name="email"]')).toBeVisible();
  await expect(form.locator('mdui-text-field[name="password"]')).toBeVisible();
  await expect(form.locator('button[type="submit"]')).toBeVisible();

  await page.locator('a[href$="/login/create"]').first().click();

  await expect(page).toHaveURL(/\/login\/create$/);
  await expect(
    page.locator('mdui-text-field[name="new-password"]'),
  ).toBeVisible();
});
