import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import customersRouter from './routes/customers.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'customers-api' });
});

/**
 * Ruta simple de login para obtener un JWT.
 * Esto NO es para producción real, pero sirve para la prueba técnica.
 * En un caso real habría usuarios en la BD.
 */
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;

  // Para la prueba: credenciales fijas desde .env (opcional)
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (email !== adminEmail || password !== adminPassword) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign(
    { sub: 'admin', email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({ token });
});

// Rutas de customers
app.use('/', customersRouter);

// Middleware de 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

export default app;
