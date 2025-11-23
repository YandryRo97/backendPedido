import { Router } from 'express';
import { authJwt } from '../midleware/authJwt.js';
import { authServiceToken } from '../midleware/authServiceToken.js';
import {
  createCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
  deleteCustomer,
  getInternalCustomer
} from '../controllers/customersController.js';

const router = Router();

// Rutas protegidas por JWT (operador backoffice)
router.post('/customers', authJwt, createCustomer);
router.get('/customers', authJwt, listCustomers);
router.get('/customers/:id', authJwt, getCustomerById);
router.put('/customers/:id', authJwt, updateCustomer);
router.delete('/customers/:id', authJwt, deleteCustomer);

// Ruta interna para Orders API (usa SERVICE_TOKEN)
router.get(
  '/internal/customers/:id',
  authServiceToken,
  getInternalCustomer
);

export default router;
