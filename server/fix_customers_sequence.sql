
-- Fix customers table sequence to prevent duplicate key errors
SELECT setval('customers_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM customers), false);
