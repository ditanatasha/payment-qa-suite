import express from "express";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";

const db = new Database(":memory:");
db.exec(`
  CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL
  );
  CREATE TABLE ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL
  );
`);

export const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/payments", async (req, res) => {
  const key = req.header("Idempotency-Key");
  const { amount, currency, card } = req.body ?? {};

  if (!key) {
    return res.status(400).json({ error: "IDEMPOTENCY_KEY_REQUIRED" });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: "INVALID_AMOUNT" });
  }
  if (!["IDR", "USD", "SGD"].includes(currency)) {
    return res.status(400).json({ error: "INVALID_CURRENCY" });
  }

  // Have we seen this key before?
  const existing = db
    .prepare("SELECT * FROM payments WHERE idempotency_key = ?")
    .get(key) as any;

  if (existing) {
    if (existing.amount !== amount || existing.currency !== currency) {
      return res.status(422).json({ error: "IDEMPOTENCY_KEY_REUSED" });
    }
    res.set("Idempotent-Replayed", "true");
    return res.status(200).json(existing);
  }

  // New key: create the payment
  const status = card === "4000000000000002" ? "DECLINED" : "SUCCEEDED";
  const id = `pay_${randomUUID()}`;

  db.prepare(
    "INSERT INTO payments (id, idempotency_key, amount, currency, status) VALUES (?, ?, ?, ?, ?)"
  ).run(id, key, amount, currency, status);

  if (status === "SUCCEEDED") {
    db.prepare("INSERT INTO ledger (payment_id, type, amount) VALUES (?, ?, ?)")
      .run(id, "CHARGE", amount);
  }

  if (req.header("x-simulate") === "timeout") {
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(id);
  res.status(status === "DECLINED" ? 402 : 201).json(payment);
});

app.get("/payments/:id", (req, res) => {
  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id);
  if (!payment) return res.status(404).json({ error: "NOT_FOUND" });
  res.json(payment);
});

app.get("/payments/:id/ledger", (req, res) => {
  const rows = db
    .prepare("SELECT type, amount FROM ledger WHERE payment_id = ?")
    .all(req.params.id);
  res.json(rows);
});