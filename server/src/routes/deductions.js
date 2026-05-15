import { verifyToken } from '../middleware/verifyToken.js';
import { institutionScope } from '../middleware/institutionScope.js';
import { db } from '../db.js';

const preHandler = [verifyToken, institutionScope];

function dbToClient(row) {
  return {
    id: row.id,
    empId: row.emp_id,
    name: row.name || '',
    withholdingTax: parseFloat(row.withholding_tax) || 0,
    laborLevel: parseFloat(row.labor_level) || 0,
    laborFee: parseFloat(row.labor_fee) || 0,
    healthLevel: parseFloat(row.health_level) || 0,
    healthFee: parseFloat(row.health_fee) || 0,
    pensionRate: parseFloat(row.pension_rate) || 0,
    pensionFee: parseFloat(row.pension_fee) || 0,
    otherDeduction: parseFloat(row.other_deduction) || 0,
  };
}

async function upsertDeduction(client, institutionCode, period, ded) {
  const { rows } = await client.query(
    `INSERT INTO deductions (institution_code, period, emp_id, name, withholding_tax, labor_level,
       labor_fee, health_level, health_fee, pension_rate, pension_fee, other_deduction)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (institution_code, period, emp_id) DO UPDATE SET
       name = EXCLUDED.name,
       withholding_tax = EXCLUDED.withholding_tax,
       labor_level = EXCLUDED.labor_level, labor_fee = EXCLUDED.labor_fee,
       health_level = EXCLUDED.health_level, health_fee = EXCLUDED.health_fee,
       pension_rate = EXCLUDED.pension_rate, pension_fee = EXCLUDED.pension_fee,
       other_deduction = EXCLUDED.other_deduction,
       updated_at = now()
     RETURNING *`,
    [
      institutionCode, period, ded.empId, ded.name || '',
      ded.withholdingTax || 0, ded.laborLevel || 0, ded.laborFee || 0,
      ded.healthLevel || 0, ded.healthFee || 0,
      ded.pensionRate || 0, ded.pensionFee || 0, ded.otherDeduction || 0,
    ]
  );
  return rows[0];
}

export async function deductionsRoutes(fastify) {
  // GET /api/deductions?period=YYYY-MM
  fastify.get('/api/deductions', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    const { rows } = await db.query(
      `SELECT * FROM deductions WHERE institution_code = $1 AND period = $2 ORDER BY emp_id`,
      [req.institution, period]
    );
    return rows.map(dbToClient);
  });

  // POST /api/deductions?period=YYYY-MM — upsert single
  fastify.post('/api/deductions', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    if (!req.body.empId) return reply.code(400).send({ error: 'empId required' });
    const client = await db.connect();
    try {
      const row = await upsertDeduction(client, req.institution, period, req.body);
      return dbToClient(row);
    } finally {
      client.release();
    }
  });

  // POST /api/deductions/import?period=YYYY-MM — bulk upsert
  fastify.post('/api/deductions/import', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    const { deductions } = req.body;
    if (!period || !Array.isArray(deductions)) return reply.code(400).send({ error: 'period and deductions required' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const d of deductions) {
        await upsertDeduction(client, req.institution, period, d);
      }
      await client.query('COMMIT');
      return { count: deductions.length };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  // DELETE /api/deductions?period=YYYY-MM — clear all for period
  fastify.delete('/api/deductions', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    await db.query(
      `DELETE FROM deductions WHERE institution_code = $1 AND period = $2`,
      [req.institution, period]
    );
    return { success: true };
  });
}
