import Fastify from 'fastify';
import cors from '@fastify/cors';
import { meRoutes } from './routes/me.js';
import { usersRoutes } from './routes/users.js';
import { employeesRoutes } from './routes/employees.js';
import { recordsRoutes } from './routes/records.js';
import { bonusesRoutes } from './routes/bonuses.js';
import { deductionsRoutes } from './routes/deductions.js';
import { acodeRoutes } from './routes/acode.js';
import { analyticsRoutes } from './routes/analytics.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  // 將 AJV schema 驗證錯誤統一轉為 { error: message }，與現有 API 錯誤格式一致
  fastify.setErrorHandler((err, _req, reply) => {
    if (err.validation) {
      const msg = err.validation[0]?.message ?? 'Validation error';
      return reply.code(400).send({ error: msg });
    }
    reply.send(err);
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
  await fastify.register(analyticsRoutes);

  return fastify;
}
