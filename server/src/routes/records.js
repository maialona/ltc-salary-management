import { verifyToken } from '../middleware/verifyToken.js';
import { institutionScope } from '../middleware/institutionScope.js';
import { db } from '../db.js';

const preHandler = [verifyToken, institutionScope];

const periodQS = {
  type: 'object',
  required: ['period'],
  properties: { period: { type: 'string', pattern: '^\\d{4}-\\d{2}$' } },
};

const recordsBody = {
  type: 'object',
  required: ['period', 'records'],
  properties: {
    period:  { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
    records: { type: 'array', items: { type: 'object' } },
  },
};

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
  fastify.get('/api/records', { preHandler, schema: { querystring: periodQS } }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    const { rows } = await db.query(
      `SELECT * FROM service_records WHERE institution_code = $1 AND period = $2 ORDER BY emp_id`,
      [req.institution, period]
    );
    return rows.map(dbToClient);
  });

  // POST /api/records — bulk upsert { period, records: [...] }
  fastify.post('/api/records', { preHandler, schema: { body: recordsBody } }, async (req, reply) => {
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

  // GET /api/records/support-bgs?period=YYYY-MM
  fastify.get('/api/records/support-bgs', { preHandler, schema: { querystring: periodQS } }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });

    const { rows } = await db.query(
      `SELECT DISTINCT ON (e_support.emp_id)
         e_support.emp_id,
         COALESCE(sr.b, 0) + COALESCE(sr.g, 0) + COALESCE(sr.s, 0) + COALESCE(sr.missed, 0)
           + COALESCE(b.bgs_other_subsidy, 0) AS main_bgs
       FROM employees e_support
       JOIN employees e_main
         ON e_main.name = e_support.name
         AND e_main.institution_code != $1
         AND e_main.is_support = false
       LEFT JOIN service_records sr
         ON sr.institution_code = e_main.institution_code
         AND sr.emp_id = e_main.emp_id
         AND sr.period = $2
       LEFT JOIN bonuses b
         ON b.institution_code = e_main.institution_code
         AND b.emp_id = e_main.emp_id
         AND b.period = $2
       WHERE e_support.institution_code = $1
         AND e_support.is_support = true
       ORDER BY e_support.emp_id`,
      [req.institution, period]
    );

    return rows.map(r => ({ empId: r.emp_id, mainBgs: parseFloat(r.main_bgs) || 0 }));
  });

  // DELETE /api/records?period=YYYY-MM — clear all for period
  fastify.delete('/api/records', { preHandler, schema: { querystring: periodQS } }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    await db.query(
      `DELETE FROM service_records WHERE institution_code = $1 AND period = $2`,
      [req.institution, period]
    );
    return { success: true };
  });
}
