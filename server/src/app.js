import Fastify from 'fastify';
import cors from '@fastify/cors';
import { meRoutes } from './routes/me.js';
import { usersRoutes } from './routes/users.js';
import { employeesRoutes } from './routes/employees.js';
import { recordsRoutes } from './routes/records.js';
import { bonusesRoutes } from './routes/bonuses.js';
import { deductionsRoutes } from './routes/deductions.js';
import { acodeRoutes } from './routes/acode.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  await fastify.register(cors, {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
    credentials: false,
  });

  // 健康檢查
  fastify.get('/health', async () => ({ ok: true }));

  await fastify.register(meRoutes);
  await fastify.register(usersRoutes);
  await fastify.register(employeesRoutes);
  await fastify.register(recordsRoutes);
  await fastify.register(bonusesRoutes);
  await fastify.register(deductionsRoutes);
  await fastify.register(acodeRoutes);

  return fastify;
}
