import { z } from 'zod';

export const createOrderSchema = z.object({
  customer_id: z.number().int().positive(),
  items: z.array(
    z.object({
      product_id: z.number().int().positive(),
      qty: z.number().int().positive()
    })
  ).min(1, 'Debe incluir al menos un item en la orden')
});
