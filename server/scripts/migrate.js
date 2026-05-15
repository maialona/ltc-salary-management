import 'dotenv/config';
import pg from 'pg';
import { runMigrations } from '../src/lib/migrate.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = { connect: () => pool.connect() };

runMigrations(db)
  .then(() => pool.end())
  .catch(err => {
    console.error('migration failed:', err.message);
    process.exit(1);
  });
