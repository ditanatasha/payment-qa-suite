import { test, expect } from "@playwright/test";
import { pay, validBody } from "./helpers";

test.describe("Refunds", () => {
  test("full refund sets status REFUNDED", async ({ request }) => {
    const payment = await (await pay(request)).json();

    const res = await request.post(`/payments/${payment.id}/refunds`, { data: {} });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("REFUNDED");
    expect(body.refunded_amount).toBe(50000);
  });

  test("partial refunds accumulate, then over-refund is blocked", async ({ request }) => {
    const payment = await (await pay(request)).json(); // 50000

    const first = await request.post(`/payments/${payment.id}/refunds`, {
      data: { amount: 20000 },
    });
    expect((await first.json()).status).toBe("PARTIALLY_REFUNDED");

    // 20000 already refunded, so only 30000 remains; 30001 must fail
    const tooMuch = await request.post(`/payments/${payment.id}/refunds`, {
      data: { amount: 30001 },
    });
    expect(tooMuch.status()).toBe(422);
    expect((await tooMuch.json()).error).toBe("REFUND_EXCEEDS_PAYMENT");
  });

  test("declined payment cannot be refunded", async ({ request }) => {
    const declined = await (
      await pay(request, { ...validBody, card: "4000000000000002" })
    ).json();

    const res = await request.post(`/payments/${declined.id}/refunds`, { data: {} });
    expect(res.status()).toBe(409);
  });

  test("refund on unknown payment returns 404", async ({ request }) => {
    const res = await request.post("/payments/pay_does_not_exist/refunds", { data: {} });
    expect(res.status()).toBe(404);
  });

  test("a fully refunded payment cannot be refunded again", async ({ request }) => {
    const payment = await (await pay(request)).json();
    await request.post(`/payments/${payment.id}/refunds`, { data: {} });

    const again = await request.post(`/payments/${payment.id}/refunds`, { data: {} });
    expect(again.status()).toBe(400);
  });

  test("ledger records the charge and each refund", async ({ request }) => {
    const payment = await (await pay(request)).json();
    await request.post(`/payments/${payment.id}/refunds`, { data: { amount: 10000 } });
    await request.post(`/payments/${payment.id}/refunds`, { data: { amount: 5000 } });

    const ledger = await (await request.get(`/payments/${payment.id}/ledger`)).json();
    expect(ledger).toEqual([
      { type: "CHARGE", amount: 50000 },
      { type: "REFUND", amount: 10000 },
      { type: "REFUND", amount: 5000 },
    ]);
  });
});