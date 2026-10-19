import { test, expect } from "@playwright/test";

test("health endpoint responds OK", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});