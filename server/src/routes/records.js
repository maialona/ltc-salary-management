import { verifyToken } from '../middleware/verifyToken.js';
import { institutionScope } from '../middleware/institutionScope.js';
import { db } from '../db.js';

const preHandler = [verifyToken, institutionScope];

function dbToClient(row) {
  return {
    id: row.id,
    empId: row.emp_id,
    b: parseFloat(row.b) || 0,
    g: parseFloat(row.g) || 0,
    s: parseFloat(row.s) || 0,
    missed: parseFloat(row.missed) || 0,
    selfPay: parseFloat(row.self_pay) || 0,
    breakdown: row.breakdown || {},
  };
}

export async function recordsRoutes(fastify) {
  // GET /api/records?period=YYYY-MM
  fastify.get('/api/records', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    const { rows } = await db.query(
      `SELECT * FROM service_records WHERE institution_code = $1 AND period = $2 ORDER BY emp_id`,
      [req.institution, period]
    );
    return rows.map(dbToClient);
  });

  // POST /api/records — bulk upsert { period, records: [...] }
  fastify.post('/api/records', { preHandler }, async (req, reply) => {
    const { period, records } = req.body;
    if (!period || !Array.isArray(records)) return reply.code(400).send({ error: 'period and records required' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const r of records) {
        await client.query(
          `INSERT INTO service_records (institution_code, period, emp_id, b, g, s, missed, self_pay, breakdown)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (institution_code, period, emp_id) DO UPDATE SET
             b = EXCLUDED.b, g = EXCLUDED.g, s = EXCLUDED.s,
             missed = EXCLUDED.missed, self_pay = EXCLUDED.self_pay,
             breakdown = EXCLUDED.breakdown, updated_at = now()`,
          [req.institution, period, r.empId, r.b || 0, r.g || 0, r.s || 0, r.missed || 0, r.selfPay || 0, JSON.stringify(r.breakdown || {})]
        );
      }
      await client.query('COMMIT');
      return { count: records.length };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  // DELETE /api/records?period=YYYY-MM — clear all for period
  fastify.delete('/api/records', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    await db.query(
      `DELETE FROM service_records WHERE institution_code = $1 AND period = $2`,
      [req.institution, period]
    );
    return { success: true };
  });
}
