import { Router } from 'express';
import { authJwt } from '../middleware/authJwt.js';
import {
  createProduct,
  updateProduct,
  getProductById,
  listProducts
} from '../controllers/productsController.js';

const router = Router();

// CRUD de productos (solo operador autenticado)
router.post('/products', authJwt, createProduct);
router.patch('/products/:id', authJwt, updateProduct);
router.get('/products/:id', authJwt, getProductById);
router.get('/products', authJwt, listProducts);

export default router;
