import express from "express";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";

// 1. Create the database and the payments table
const db = new Database(":memory:");
db.exec(`
  CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL
  );
`);

export const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// 2. Create a payment
app.post("/payments", (req, res) => {
  const { amount, currency, card } = req.body ?? {};

  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: "INVALID_AMOUNT" });
  }
  if (!["IDR", "USD", "SGD"].includes(currency)) {
    return res.status(400).json({ error: "INVALID_CURRENCY" });
  }

  // Test card: 4000000000000002 is always declined
  const status = card === "4000000000000002" ? "DECLINED" : "SUCCEEDED";
  const id = `pay_${randomUUID()}`;

  db.prepare("INSERT INTO payments (id, amount, currency, status) VALUES (?, ?, ?, ?)")
    .run(id, amount, currency, status);

  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(id);
  res.status(status === "DECLINED" ? 402 : 201).json(payment);
});

// 3. Look up a payment
app.get("/payments/:id", (req, res) => {
  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id);
  if (!payment) return res.status(404).json({ error: "NOT_FOUND" });
  res.json(payment);
});