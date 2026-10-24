-- 1. Payments whose ledger does not match (the main reconciliation check)
SELECT p.id, p.status, p.amount, p.refunded_amount,
  COALESCE(SUM(CASE WHEN l.type = 'CHARGE' THEN l.amount END), 0) AS charged,
  COALESCE(SUM(CASE WHEN l.type = 'REFUND' THEN l.amount END), 0) AS refunded
FROM payments p
LEFT JOIN ledger l ON l.payment_id = p.id
GROUP BY p.id
HAVING (p.status != 'DECLINED' AND charged != p.amount)
    OR (p.status = 'DECLINED' AND charged != 0)
    OR refunded != p.refunded_amount;

-- 2. Duplicate charges: more than one CHARGE row for the same payment
SELECT payment_id, COUNT(*) AS charge_count
FROM ledger
WHERE type = 'CHARGE'
GROUP BY payment_id
HAVING COUNT(*) > 1;

-- 3. Over-refunds: refunded more than the payment amount
SELECT p.id, p.amount, SUM(l.amount) AS total_refunded
FROM payments p
JOIN ledger l ON l.payment_id = p.id AND l.type = 'REFUND'
GROUP BY p.id
HAVING SUM(l.amount) > p.amount;

-- 4. Orphan ledger rows: ledger entries with no matching payment
SELECT l.*
FROM ledger l
LEFT JOIN payments p ON p.id = l.payment_id
WHERE p.id IS NULL;