import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().min(5).max(50)
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().min(5).max(50).optional()
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'Debe enviar al menos un campo para actualizar' }
);
