-- Crear base de datos
CREATE DATABASE IF NOT EXISTS b2b_orders
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE b2b_orders;

-- =========================
-- Tabla: customers
-- =========================
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL,
  deleted_at DATETIME NULL
) ENGINE=InnoDB;

-- Índices útiles
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_created_at ON customers(created_at);

-- =========================
-- Tabla: products
-- =========================
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  price_cents INT NOT NULL,
  stock INT NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB;

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products(name);

-- =========================
-- Tabla: orders
-- =========================
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  status ENUM('CREATED','CONFIRMED','CANCELED') NOT NULL,
  total_cents INT NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- =========================
-- Tabla: order_items
-- =========================
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  qty INT NOT NULL,
  unit_price_cents INT NOT NULL,
  subtotal_cents INT NOT NULL,
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- =========================
-- Tabla: idempotency_keys
-- =========================
CREATE TABLE IF NOT EXISTS idempotency_keys (
  `key` VARCHAR(255) PRIMARY KEY,
  target_type VARCHAR(50) NOT NULL,
  target_id INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  response_body JSON NOT NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL
) ENGINE=InnoDB;

CREATE INDEX idx_idempotency_target
  ON idempotency_keys(target_type, target_id);
CREATE INDEX idx_idempotency_expires_at
  ON idempotency_keys(expires_at);
