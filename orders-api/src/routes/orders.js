import { Router } from 'express';
import { authJwt } from '../middleware/authJwt.js';
import {
  createOrder,
  getOrderById,
  listOrders,
  confirmOrder,
  cancelOrder
} from '../controllers/ordersController.js';

const router = Router();

// Órdenes
router.post('/orders', authJwt, createOrder);
router.get('/orders/:id', authJwt, getOrderById);
router.get('/orders', authJwt, listOrders);
router.post('/orders/:id/confirm', authJwt, confirmOrder);
router.post('/orders/:id/cancel', authJwt, cancelOrder);

export default router;
