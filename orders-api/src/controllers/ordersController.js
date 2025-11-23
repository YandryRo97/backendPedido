import pool from '../db/pool.js';
import { createOrderSchema } from '../validators/orderSchema.js';
import { fetchCustomerById } from '../services/customersClient.js';

// Util para formatear orden consolidada
async function getOrderWithItems(connectionOrPool, orderId) {
  const conn = connectionOrPool;
  const [[order]] = await conn.query(
    'SELECT id, customer_id, status, total_cents, created_at FROM orders WHERE id = ?',
    [orderId]
  );
  if (!order) return null;

  const [items] = await conn.query(
    `SELECT oi.id, oi.product_id, p.sku, p.name,
            oi.qty, oi.unit_price_cents, oi.subtotal_cents
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [orderId]
  );

  return { ...order, items };
}

// POST /orders
export async function createOrder(req, res) {
  let connection;
  try {
    const parsed = createOrderSchema.parse({
      ...req.body,
      customer_id: Number(req.body.customer_id),
      items: (req.body.items || []).map((item) => ({
        product_id: Number(item.product_id),
        qty: Number(item.qty)
      }))
    });

    // 1. Validar cliente en Customers API (endpoint /internal)
    const customer = await fetchCustomerById(parsed.customer_id);
    if (!customer) {
      return res.status(400).json({ error: 'Cliente no existe' });
    }

    // 2. Transacción para stock + orden
    connection = await pool.getConnection();
    await connection.beginTransaction();

    let totalCents = 0;
    const productMap = new Map(); // product_id -> { price_cents, stock }

    // 2.1 Verificar productos y stock (SELECT ... FOR UPDATE)
    for (const item of parsed.items) {
      const [[product]] = await connection.query(
        'SELECT id, price_cents, stock FROM products WHERE id = ? FOR UPDATE',
        [item.product_id]
      );

      if (!product) {
        await connection.rollback();
        return res.status(400).json({ error: `Producto ${item.product_id} no existe` });
      }

      if (product.stock < item.qty) {
        await connection.rollback();
        return res.status(400).json({
          error: `Stock insuficiente para producto ${item.product_id}`
        });
      }

      totalCents += product.price_cents * item.qty;
      productMap.set(item.product_id, product);
    }

    // 2.2 Crear orden en estado CREATED
    const [orderResult] = await connection.query(
      `INSERT INTO orders (customer_id, status, total_cents, created_at)
       VALUES (?, 'CREATED', ?, NOW())`,
      [parsed.customer_id, totalCents]
    );
    const orderId = orderResult.insertId;

    // 2.3 Crear order_items y descontar stock
    for (const item of parsed.items) {
      const product = productMap.get(item.product_id);
      const unitPrice = product.price_cents;
      const subtotal = unitPrice * item.qty;

      await connection.query(
        `INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, subtotal_cents)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.qty, unitPrice, subtotal]
      );

      await connection.query(
        `UPDATE products
         SET stock = stock - ?
         WHERE id = ?`,
        [item.qty, item.product_id]
      );
    }

    await connection.commit();

    const orderWithItems = await getOrderWithItems(pool, orderId);

    return res.status(201).json(orderWithItems);
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Datos inválidos', details: err.errors });
    }
    console.error('Error createOrder:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}

// GET /orders/:id
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const orderWithItems = await getOrderWithItems(pool, id);
    if (!orderWithItems) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    return res.json(orderWithItems);
  } catch (err) {
    console.error('Error getOrderById:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /orders?status=&from=&to=&cursor=&limit=
export async function listOrders(req, res) {
  try {
    const { status, from, to } = req.query;
    const cursor = Number(req.query.cursor || 0);
    const limit = Math.min(Number(req.query.limit || 10), 50);

    const params = [];
    let where = 'WHERE 1=1';

    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }
    if (from) {
      where += ' AND created_at >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND created_at <= ?';
      params.push(to);
    }
    if (cursor > 0) {
      where += ' AND id > ?';
      params.push(cursor);
    }

    const sql = `
      SELECT id, customer_id, status, total_cents, created_at
      FROM orders
      ${where}
      ORDER BY id
      LIMIT ?
    `;
    params.push(limit);

    const [rows] = await pool.query(sql, params);
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

    return res.json({ data: rows, nextCursor });
  } catch (err) {
    console.error('Error listOrders:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /orders/:id/confirm (idempotente por X-Idempotency-Key)
export async function confirmOrder(req, res) {
  let connection;
  try {
    const { id } = req.params;
    const idempotencyKey =
      req.headers['x-idempotency-key'] || req.headers['X-Idempotency-Key'];

    if (!idempotencyKey) {
      return res.status(400).json({ error: 'X-Idempotency-Key es requerido' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. ¿ya existe registro de idempotencia?
    const [existingKeys] = await connection.query(
      `SELECT response_body
       FROM idempotency_keys
       WHERE \`key\` = ? AND target_type = 'ORDER_CONFIRMATION'`,
      [idempotencyKey]
    );

    if (existingKeys.length > 0) {
      // Ya fue procesado, devolvemos misma respuesta
      const savedResponse = existingKeys[0].response_body;
      await connection.commit();
      return res.status(200).json(savedResponse);
    }

    // 2. Bloqueamos la orden
    const [[order]] = await connection.query(
      `SELECT id, status, total_cents, customer_id, created_at
       FROM orders
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    if (order.status === 'CANCELED') {
      await connection.rollback();
      return res.status(409).json({ error: 'Orden está cancelada' });
    }

    if (order.status === 'CONFIRMED') {
      // Ya confirmada pero con nueva key → puedes decidir devolver 200 con estado actual,
      // sin registrar idempotencia porque la key es nueva. O registrarla.
      // Para esta prueba, devolvemos el estado actual sin cambiar nada.
      const orderWithItems = await getOrderWithItems(connection, id);
      await connection.commit();
      return res.status(200).json(orderWithItems);
    }

    // 3. Cambiar a CONFIRMED
    await connection.query(
      `UPDATE orders
       SET status = 'CONFIRMED'
       WHERE id = ?`,
      [id]
    );

    const orderWithItems = await getOrderWithItems(connection, id);

    const responseBody = orderWithItems;

    // 4. Guardar idempotency_keys
    await connection.query(
      `INSERT INTO idempotency_keys
        (\`key\`, target_type, target_id, status, response_body, created_at, expires_at)
       VALUES (?, 'ORDER_CONFIRMATION', ?, 'COMPLETED', ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY))`,
      [idempotencyKey, id, JSON.stringify(responseBody)]
    );

    await connection.commit();
    return res.status(200).json(responseBody);
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    console.error('Error confirmOrder:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}

// POST /orders/:id/cancel
export async function cancelOrder(req, res) {
  let connection;
  try {
    const { id } = req.params;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [[order]] = await connection.query(
      `SELECT id, status, total_cents, created_at
       FROM orders
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    if (order.status === 'CANCELED') {
      await connection.rollback();
      return res.status(409).json({ error: 'Orden ya está cancelada' });
    }

    // Traer items para posible restauración de stock
    const [items] = await connection.query(
      `SELECT product_id, qty
       FROM order_items
       WHERE order_id = ?`,
      [id]
    );

    if (order.status === 'CREATED') {
      // Restaurar stock y cancelar
      for (const item of items) {
        await connection.query(
          `UPDATE products
           SET stock = stock + ?
           WHERE id = ?`,
          [item.qty, item.product_id]
        );
      }

      await connection.query(
        `UPDATE orders
         SET status = 'CANCELED'
         WHERE id = ?`,
        [id]
      );

      await connection.commit();
      return res.status(200).json({ message: 'Orden cancelada y stock restaurado' });
    }

    if (order.status === 'CONFIRMED') {
      // Solo permitir cancelar si han pasado <= 10 minutos
      const [[{ minutesDiff }]] = await connection.query(
        `SELECT TIMESTAMPDIFF(MINUTE, created_at, NOW()) AS minutesDiff
         FROM orders
         WHERE id = ?`,
        [id]
      );

      if (minutesDiff > 10) {
        await connection.rollback();
        return res.status(409).json({
          error: 'No se puede cancelar una orden CONFIRMED después de 10 minutos'
        });
      }

      // Aquí puedes decidir si restauras stock o no.
      // La consigna dice "CONFIRMED cancela dentro de 10 min (regla simple)".
      // Implementamos restauración también.
      for (const item of items) {
        await connection.query(
          `UPDATE products
           SET stock = stock + ?
           WHERE id = ?`,
          [item.qty, item.product_id]
        );
      }

      await connection.query(
        `UPDATE orders
         SET status = 'CANCELED'
         WHERE id = ?`,
        [id]
      );

      await connection.commit();
      return res.status(200).json({
        message: 'Orden CONFIRMED cancelada dentro de los 10 minutos y stock restaurado'
      });
    }

    // Por si aparece otro estado
    await connection.rollback();
    return res.status(409).json({ error: `Estado de orden no soportado: ${order.status}` });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    console.error('Error cancelOrder:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (connection) connection.release();
  }
}
