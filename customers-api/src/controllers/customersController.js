import pool from '../db/pool.js';
import {
  createCustomerSchema,
  updateCustomerSchema
} from '../validators/customerSchema.js';

// POST /customers
export async function createCustomer(req, res) {
  try {
    const parsed = createCustomerSchema.parse(req.body);

    // Verificar email único
    const [existing] = await pool.query(
      'SELECT id FROM customers WHERE email = ? AND deleted_at IS NULL',
      [parsed.email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email ya está registrado' });
    }

    const [result] = await pool.query(
      'INSERT INTO customers (name, email, phone, created_at) VALUES (?, ?, ?, NOW())',
      [parsed.name, parsed.email, parsed.phone]
    );

    const [rows] = await pool.query(
      'SELECT id, name, email, phone, created_at FROM customers WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.errors });
    }
    console.error('Error createCustomer:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /customers/:id
export async function getCustomerById(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      'SELECT id, name, email, phone, created_at FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('Error getCustomerById:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /customers?search=&cursor=&limit=
export async function listCustomers(req, res) {
  try {
    const search = (req.query.search || '').trim();
    const cursor = Number(req.query.cursor || 0);
    const limit = Math.min(Number(req.query.limit || 10), 50); // máx 50

    const like = `%${search}%`;

    const params = [];
    let where = 'WHERE deleted_at IS NULL';

    if (search) {
      where += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      params.push(like, like, like);
    }

    if (cursor > 0) {
      where += ' AND id > ?';
      params.push(cursor);
    }

    const sql = `
      SELECT id, name, email, phone, created_at
      FROM customers
      ${where}
      ORDER BY id
      LIMIT ?
    `;

    params.push(limit);

    const [rows] = await pool.query(sql, params);

    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

    return res.json({
      data: rows,
      nextCursor
    });
  } catch (err) {
    console.error('Error listCustomers:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT /customers/:id
export async function updateCustomer(req, res) {
  try {
    const { id } = req.params;
    const parsed = updateCustomerSchema.parse(req.body);

    // Verificar que el cliente existe
    const [existingRows] = await pool.query(
      'SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Evitar duplicidad de email
    if (parsed.email) {
      const [dup] = await pool.query(
        'SELECT id FROM customers WHERE email = ? AND id <> ? AND deleted_at IS NULL',
        [parsed.email, id]
      );

      if (dup.length > 0) {
        return res.status(409).json({ error: 'Email ya está en uso por otro cliente' });
      }
    }

    const fields = [];
    const values = [];

    if (parsed.name !== undefined) {
      fields.push('name = ?');
      values.push(parsed.name);
    }
    if (parsed.email !== undefined) {
      fields.push('email = ?');
      values.push(parsed.email);
    }
    if (parsed.phone !== undefined) {
      fields.push('phone = ?');
      values.push(parsed.phone);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    const sql = `
      UPDATE customers
      SET ${fields.join(', ')}
      WHERE id = ? AND deleted_at IS NULL
    `;

    values.push(id);

    await pool.query(sql, values);

    const [updated] = await pool.query(
      'SELECT id, name, email, phone, created_at FROM customers WHERE id = ?',
      [id]
    );

    return res.json(updated[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.errors });
    }
    console.error('Error updateCustomer:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE /customers/:id  (soft delete)
export async function deleteCustomer(req, res) {
  try {
    const { id } = req.params;

    const [existingRows] = await pool.query(
      'SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado o ya eliminado' });
    }

    await pool.query(
      'UPDATE customers SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    return res.status(204).send();
  } catch (err) {
    console.error('Error deleteCustomer:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /internal/customers/:id (para Orders API)
export async function getInternalCustomer(req, res) {
  // La auth por SERVICE_TOKEN ya se valida en el middleware
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      'SELECT id, name, email, phone, created_at FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('Error getInternalCustomer:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
