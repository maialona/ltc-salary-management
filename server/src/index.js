import 'dotenv/config';
import { buildApp } from './app.js';
import { db } from './db.js';
import { runMigrations } from './lib/migrate.js';

const PORT = Number(process.env.PORT) || 3000;

console.log('Running migrations...');
await runMigrations(db);

const fastify = await buildApp();
await fastify.listen({ port: PORT, host: '0.0.0.0' });
console.log(`API server running on port ${PORT}`);
