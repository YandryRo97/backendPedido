import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  price_cents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative()
});

export const updateProductSchema = z.object({
  price_cents: z.number().int().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Debe enviar al menos un campo para actualizar' }
);
