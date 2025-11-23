import app from './app.js';
import dotenv from 'dotenv';
import pool from './db/pool.js';

dotenv.config();

const port = Number(process.env.PORT || 3002);

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('Conectado a MySQL correctamente (Orders API)');

    app.listen(port, () => {
      console.log(`Orders API escuchando en http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Error al conectar a MySQL (Orders API):', err);
    process.exit(1);
  }
}

start();
