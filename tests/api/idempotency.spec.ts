import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";
import { pay, validBody } from "./helpers";

test.describe("Duplicate requests", () => {
  test("same key twice returns the same payment, charged once", async ({ request }) => {
    const key = randomUUID();

    const first = await pay(request, validBody, key);
    const firstBody = await first.json();
    expect(first.status()).toBe(201);

    const second = await pay(request, validBody, key);
    expect(second.status()).toBe(200);
    expect(second.headers()["idempotent-replayed"]).toBe("true");
    expect((await second.json()).id).toBe(firstBody.id);

    // The real proof: only ONE charge in the ledger
    const ledger = await (await request.get(`/payments/${firstBody.id}/ledger`)).json();
    expect(ledger).toHaveLength(1);
  });

  test("same key with a different amount is rejected", async ({ request }) => {
    const key = randomUUID();
    await pay(request, validBody, key);

    const res = await pay(request, { ...validBody, amount: 99999 }, key);
    expect(res.status()).toBe(422);
    expect((await res.json()).error).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  test("different keys create different payments", async ({ request }) => {
    const a = await (await pay(request)).json();
    const b = await (await pay(request)).json();
    expect(a.id).not.toBe(b.id);
  });

  test("5 concurrent requests with one key create one payment", async ({ request }) => {
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => pay(request, validBody, key))
    );
    const ids = new Set(await Promise.all(results.map(async (r) => (await r.json()).id)));
    expect(ids.size).toBe(1);
  });
});