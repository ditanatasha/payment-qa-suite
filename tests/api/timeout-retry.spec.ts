import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";
import { pay, validBody } from "./helpers";

test("client times out, retries with the same key, and is not double-charged", async ({ request }) => {
  const key = randomUUID();

  // Step 1: the server saves the payment but answers slowly; the client gives up after 1 second
  await expect(
    request.post("/payments", {
      data: validBody,
      headers: { "Idempotency-Key": key, "x-simulate": "timeout" },
      timeout: 1000,
    })
  ).rejects.toThrow(/timeout|timed out/i);

  // Step 2: the client retries with the SAME key
  const retry = await pay(request, validBody, key);
  expect(retry.status()).toBe(200);
  expect(retry.headers()["idempotent-replayed"]).toBe("true");

  // Step 3: the money side shows exactly one charge
  const payment = await retry.json();
  const ledger = await (await request.get(`/payments/${payment.id}/ledger`)).json();
  expect(ledger.filter((entry: any) => entry.type === "CHARGE")).toHaveLength(1);
});