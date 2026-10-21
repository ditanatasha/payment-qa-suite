import { test, expect } from "@playwright/test";
import { pay, validBody } from "./helpers";

test.describe("Payment creation", () => {
  test("approved card returns SUCCEEDED", async ({ request }) => {
    const res = await pay(request);

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("SUCCEEDED");
    expect(body.amount).toBe(50000);
    expect(body.id).toMatch(/^pay_/);
  });

  test("declined card returns 402 DECLINED", async ({ request }) => {
    const res = await pay(request, { ...validBody, card: "4000000000000002" });

    expect(res.status()).toBe(402);
    expect((await res.json()).status).toBe("DECLINED");
  });

  for (const amount of [0, -100, 10.5, "500"]) {
    test(`rejects invalid amount: ${amount}`, async ({ request }) => {
      const res = await pay(request, { ...validBody, amount });
      expect(res.status()).toBe(400);
    });
  }

  test("rejects unsupported currency", async ({ request }) => {
    const res = await pay(request, { ...validBody, currency: "XXX" });
    expect(res.status()).toBe(400);
  });

  test("rejects missing idempotency key", async ({ request }) => {
    const res = await request.post("/payments", { data: validBody });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  test("created payment can be fetched by id", async ({ request }) => {
    const created = await (await pay(request)).json();
    const res = await request.get(`/payments/${created.id}`);

    expect(res.status()).toBe(200);
    expect((await res.json()).id).toBe(created.id);
  });

  test("unknown payment id returns 404", async ({ request }) => {
    const res = await request.get("/payments/pay_does_not_exist");
    expect(res.status()).toBe(404);
  });
});