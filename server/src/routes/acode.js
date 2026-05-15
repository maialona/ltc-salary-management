import { verifyToken } from '../middleware/verifyToken.js';
import { institutionScope } from '../middleware/institutionScope.js';
import { db } from '../db.js';

const preHandler = [verifyToken, institutionScope];

export async function acodeRoutes(fastify) {
  // GET /api/acode-results?period=YYYY-MM
  fastify.get('/api/acode-results', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    const { rows } = await db.query(
      `SELECT data FROM acode_results WHERE institution_code = $1 AND period = $2`,
      [req.institution, period]
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'not found' });
    return rows[0].data;
  });

  // PUT /api/acode-results?period=YYYY-MM — upsert full results object
  fastify.put('/api/acode-results', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    await db.query(
      `INSERT INTO acode_results (institution_code, period, data)
       VALUES ($1, $2, $3)
       ON CONFLICT (institution_code, period) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [req.institution, period, JSON.stringify(req.body)]
    );
    return { success: true };
  });

  // DELETE /api/acode-results?period=YYYY-MM
  fastify.delete('/api/acode-results', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    await db.query(
      `DELETE FROM acode_results WHERE institution_code = $1 AND period = $2`,
      [req.institution, period]
    );
    return { success: true };
  });
}
