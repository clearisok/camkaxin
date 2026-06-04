import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function init() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  console.log('Initializing database schema...');
  await pool.query(schema);
  console.log('Database schema initialized successfully.');
  await pool.end();
}

init().catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
