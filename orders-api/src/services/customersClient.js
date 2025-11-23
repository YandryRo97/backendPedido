import axios from 'axios';

const baseURL = process.env.CUSTOMERS_API_BASE || 'http://localhost:3001';
const serviceToken = process.env.SERVICE_TOKEN;

export async function fetchCustomerById(customerId) {
  try {
    const res = await axios.get(
      `${baseURL}/internal/customers/${customerId}`,
      {
        headers: {
          Authorization: `Bearer ${serviceToken}`
        },
        timeout: 3000
      }
    );
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return null;
    }
    console.error('Error llamando a Customers API:', err.message);
    throw new Error('Error al validar cliente en Customers API');
  }
}
