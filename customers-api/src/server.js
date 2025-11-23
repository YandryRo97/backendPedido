import app from './app.js';
import dotenv from 'dotenv';
import pool from './db/pool.js';

dotenv.config();

const port = Number(process.env.PORT || 3001);

async function start() {
  try {
    // Comprobar conexión a la BD al arrancar
    await pool.query('SELECT 1');
    console.log('Conectado a MySQL correctamente');

    app.listen(port, () => {
      console.log(`Customers API escuchando en http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Error al conectar a MySQL:', err);
    process.exit(1);
  }
}

start();
