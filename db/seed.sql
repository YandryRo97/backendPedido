USE b2b_orders;

-- Limpiar datos previos (opcional, útil en desarrollo)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE idempotency_keys;
TRUNCATE TABLE order_items;
TRUNCATE TABLE orders;
TRUNCATE TABLE products;
TRUNCATE TABLE customers;
SET FOREIGN_KEY_CHECKS = 1;

-- =========================
-- Clientes de ejemplo
-- =========================
INSERT INTO customers (name, email, phone, created_at, deleted_at) VALUES
  ('ACME Corp',       'ops@acme.com',       '0999999999', NOW(), NULL),
  ('Globex S.A.',     'compras@globex.com', '0988888888', NOW(), NULL),
  ('Initech Ltd.',    'ventas@initech.com', '0977777777', NOW(), NULL);

-- =========================
-- Productos de ejemplo
-- =========================
INSERT INTO products (sku, name, price_cents, stock, created_at) VALUES
  ('TV-001', 'Televisor 50\" UHD',          129900, 20, NOW()),
  ('TV-002', 'Televisor 65\" 4K',           189900, 15, NOW()),
  ('SND-001', 'Barra de sonido premium',     59900, 30, NOW()),
  ('FRG-001', 'Refrigeradora 300L No Frost',149900, 10, NOW());

-- =========================
-- (Opcional) Orden de ejemplo
-- =========================
-- Creamos una orden CREATED para customer_id = 1 (ACME)
INSERT INTO orders (customer_id, status, total_cents, created_at) VALUES
  (1, 'CREATED', 0, NOW());

SET @last_order_id = LAST_INSERT_ID();

-- Supongamos que ACME pide:
-- 2 x TV-001 (129900 c/u) y 1 x SND-001 (59900)
INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, subtotal_cents) VALUES
  (@last_order_id, 1, 2, 129900, 2 * 129900),
  (@last_order_id, 3, 1,  59900, 1 *  59900);

-- Actualizamos el total_cents de la orden
UPDATE orders
SET total_cents = (
  SELECT SUM(subtotal_cents)
  FROM order_items
  WHERE order_id = @last_order_id
)
WHERE id = @last_order_id;

-- Ajustamos stock como si esta orden ya hubiera descontado stock
UPDATE products
SET stock = stock - 2
WHERE id = 1; -- TV-001

UPDATE products
SET stock = stock - 1
WHERE id = 3; -- SND-001
