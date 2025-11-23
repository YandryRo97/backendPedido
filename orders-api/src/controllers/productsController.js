import pool from '../db/pool.js';
import {
  createProductSchema,
  updateProductSchema
} from '../validators/productSchema.js';

// POST /products
export async function createProduct(req, res) {
  try {
    const parsed = createProductSchema.parse({
      ...req.body,
      price_cents: Number(req.body.price_cents),
      stock: Number(req.body.stock)
    });

    const [existing] = await pool.query(
      'SELECT id FROM products WHERE sku = ?',
      [parsed.sku]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'SKU ya existe' });
    }

    const [result] = await pool.query(
      `INSERT INTO products (sku, name, price_cents, stock, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [parsed.sku, parsed.name, parsed.price_cents, parsed.stock]
    );

    const [rows] = await pool.query(
      'SELECT id, sku, name, price_cents, stock, created_at FROM products WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.errors });
    }
    console.error('Error createProduct:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PATCH /products/:id
export async function updateProduct(req, res) {
  try {
    const parsed = updateProductSchema.parse({
      price_cents: req.body.price_cents !== undefined ? Number(req.body.price_cents) : undefined,
      stock: req.body.stock !== undefined ? Number(req.body.stock) : undefined
    });

    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT id FROM products WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const fields = [];
    const values = [];

    if (parsed.price_cents !== undefined) {
      fields.push('price_cents = ?');
      values.push(parsed.price_cents);
    }
    if (parsed.stock !== undefined) {
      fields.push('stock = ?');
      values.push(parsed.stock);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    const sql = `
      UPDATE products
      SET ${fields.join(', ')}
      WHERE id = ?
    `;
    values.push(id);

    await pool.query(sql, values);

    const [rows] = await pool.query(
      'SELECT id, sku, name, price_cents, stock, created_at FROM products WHERE id = ?',
      [id]
    );
    return res.json(rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.errors });
    }
    console.error('Error updateProduct:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /products/:id
export async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT id, sku, name, price_cents, stock, created_at FROM products WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Error getProductById:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /products?search=&cursor=&limit=
export async function listProducts(req, res) {
  try {
    const search = (req.query.search || '').trim();
    const cursor = Number(req.query.cursor || 0);
    const limit = Math.min(Number(req.query.limit || 10), 50);

    const like = `%${search}%`;
    const params = [];
    let where = 'WHERE 1=1';

    if (search) {
      where += ' AND (sku LIKE ? OR name LIKE ?)';
      params.push(like, like);
    }

    if (cursor > 0) {
      where += ' AND id > ?';
      params.push(cursor);
    }

    const sql = `
      SELECT id, sku, name, price_cents, stock, created_at
      FROM products
      ${where}
      ORDER BY id
      LIMIT ?
    `;
    params.push(limit);

    const [rows] = await pool.query(sql, params);
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

    return res.json({ data: rows, nextCursor });
  } catch (err) {
    console.error('Error listProducts:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
