import axios from 'axios';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const CUSTOMERS_API_BASE = process.env.CUSTOMERS_API_BASE || 'http://localhost:3001';
const ORDERS_API_BASE = process.env.ORDERS_API_BASE || 'http://localhost:3002';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;

// Crear un JWT para llamar a Orders API
function buildServiceJwt() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET no configurado en Lambda');
  }
  return jwt.sign(
    {
      sub: 'lambda-orchestrator',
      role: 'service'
    },
    JWT_SECRET,
    { expiresIn: '5m' }
  );
}

// Helper para respuestas API Gateway
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

// Validación simple del body
function validateRequestBody(body) {
  if (!body) {
    throw { statusCode: 400, message: 'Body requerido' };
  }

  const { customer_id, items, idempotency_key } = body;

  if (!customer_id || typeof customer_id !== 'number') {
    throw { statusCode: 400, message: 'customer_id debe ser número' };
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw { statusCode: 400, message: 'items debe ser un array con al menos un elemento' };
  }

  for (const item of items) {
    if (
      !item.product_id ||
      typeof item.product_id !== 'number' ||
      !item.qty ||
      typeof item.qty !== 'number'
    ) {
      throw {
        statusCode: 400,
        message: 'Cada item debe tener product_id (number) y qty (number)'
      };
    }
  }

  if (!idempotency_key || typeof idempotency_key !== 'string') {
    throw { statusCode: 400, message: 'idempotency_key es requerido (string)' };
  }
}

// Lambda handler
export async function orchestrate(event) {
  try {
    // 1) Parsear body
    const rawBody = event.body || '{}';
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;

    validateRequestBody(body);

    const { customer_id, items, idempotency_key, correlation_id } = body;

    // 2) Validar cliente en Customers API (endpoint /internal/customers/:id)
    if (!SERVICE_TOKEN) {
      throw { statusCode: 500, message: 'SERVICE_TOKEN no configurado en Lambda' };
    }

    let customer;
    try {
      const customerRes = await axios.get(
        `${CUSTOMERS_API_BASE}/internal/customers/${customer_id}`,
        {
          headers: {
            Authorization: `Bearer ${SERVICE_TOKEN}`
          },
          timeout: 3000
        }
      );
      customer = customerRes.data;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        throw { statusCode: 400, message: 'Cliente no existe (Customers API devolvió 404)' };
      }
      console.error('Error llamando a Customers API:', err.message);
      throw { statusCode: 502, message: 'Error al validar cliente en Customers API' };
    }

    // 3) Crear orden en Orders API
    const serviceJwt = buildServiceJwt();

    let createdOrder;
    try {
      const createOrderRes = await axios.post(
        `${ORDERS_API_BASE}/orders`,
        {
          customer_id,
          items
        },
        {
          headers: {
            Authorization: `Bearer ${serviceJwt}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      createdOrder = createOrderRes.data;
    } catch (err) {
      console.error('Error llamando a Orders API (create order):', err.message);

      if (err.response) {
        // Propagar mensaje más detallado si viene de Orders API
        return response(err.response.status, {
          success: false,
          correlationId: correlation_id || null,
          error: 'Error creando la orden',
          details: err.response.data
        });
      }

      throw { statusCode: 502, message: 'Error al crear la orden en Orders API' };
    }

    const orderId = createdOrder.id;
    if (!orderId) {
      throw {
        statusCode: 500,
        message: 'Orders API no retornó id de la orden creada'
      };
    }

    // 4) Confirmar orden con X-Idempotency-Key
    let confirmedOrder;
    try {
      const confirmRes = await axios.post(
        `${ORDERS_API_BASE}/orders/${orderId}/confirm`,
        {},
        {
          headers: {
            Authorization: `Bearer ${serviceJwt}`,
            'X-Idempotency-Key': idempotency_key
          },
          timeout: 5000
        }
      );
      confirmedOrder = confirmRes.data;
    } catch (err) {
      console.error('Error llamando a Orders API (confirm order):', err.message);

      if (err.response) {
        return response(err.response.status, {
          success: false,
          correlationId: correlation_id || null,
          error: 'Error confirmando la orden',
          details: err.response.data
        });
      }

      throw { statusCode: 502, message: 'Error al confirmar la orden en Orders API' };
    }

    // 5) Respuesta consolidada
    const result = {
      success: true,
      correlationId: correlation_id || null,
      data: {
        customer,
        order: confirmedOrder
      }
    };

    // 201 según el enunciado
    return response(201, result);
  } catch (err) {
    console.error('Error en orquestator:', err);

    if (err.statusCode) {
      return response(err.statusCode, {
        success: false,
        error: err.message || 'Error en orquestador'
      });
    }

    return response(500, {
      success: false,
      error: 'Error interno en orquestador'
    });
  }
}
