import { APIRequestContext } from "@playwright/test";
import { randomUUID } from "crypto";

export const validBody = { amount: 50000, currency: "IDR", card: "4242424242424242" };

export const pay = (
  request: APIRequestContext,
  body: object = validBody,
  key: string = randomUUID()
) =>
  request.post("/payments", {
    data: body,
    headers: { "Idempotency-Key": key },
  });