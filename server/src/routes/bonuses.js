import { verifyToken } from '../middleware/verifyToken.js';
import { institutionScope } from '../middleware/institutionScope.js';
import { db } from '../db.js';

const preHandler = [verifyToken, institutionScope];

function dbToClient(row) {
  return {
    id: row.id,
    empId: row.emp_id,
    name: row.name || '',
    bonusA: parseFloat(row.bonus_a) || 0,
    bonusC: parseFloat(row.bonus_c) || 0,
    bonusOpen: parseFloat(row.bonus_open) || 0,
    bonusDev: parseFloat(row.bonus_dev) || 0,
    bonusCross: parseFloat(row.bonus_cross) || 0,
    referral: parseFloat(row.referral) || 0,
    mentoring: parseFloat(row.mentoring) || 0,
    fuel: parseFloat(row.fuel) || 0,
    other: parseFloat(row.other) || 0,
    bgsOtherSubsidy: parseFloat(row.bgs_other_subsidy) || 0,
    otherSubsidy: parseFloat(row.other_subsidy) || 0,
    holidayBonus: parseFloat(row.holiday_bonus) || 0,
  };
}

async function upsertBonus(client, institutionCode, period, bonus) {
  const { rows } = await client.query(
    `INSERT INTO bonuses (institution_code, period, emp_id, name, bonus_a, bonus_c, bonus_open, bonus_dev,
       bonus_cross, referral, mentoring, fuel, other, bgs_other_subsidy, other_subsidy, holiday_bonus)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (institution_code, period, emp_id) DO UPDATE SET
       name = EXCLUDED.name,
       bonus_a = EXCLUDED.bonus_a, bonus_c = EXCLUDED.bonus_c,
       bonus_open = EXCLUDED.bonus_open, bonus_dev = EXCLUDED.bonus_dev,
       bonus_cross = EXCLUDED.bonus_cross, referral = EXCLUDED.referral,
       mentoring = EXCLUDED.mentoring, fuel = EXCLUDED.fuel, other = EXCLUDED.other,
       bgs_other_subsidy = EXCLUDED.bgs_other_subsidy,
       other_subsidy = EXCLUDED.other_subsidy,
       holiday_bonus = EXCLUDED.holiday_bonus,
       updated_at = now()
     RETURNING *`,
    [
      institutionCode, period, bonus.empId, bonus.name || '',
      bonus.bonusA || 0, bonus.bonusC || 0, bonus.bonusOpen || 0, bonus.bonusDev || 0,
      bonus.bonusCross || 0, bonus.referral || 0, bonus.mentoring || 0,
      bonus.fuel || 0, bonus.other || 0,
      bonus.bgsOtherSubsidy || 0, bonus.otherSubsidy || 0, bonus.holidayBonus || 0,
    ]
  );
  return rows[0];
}

export async function bonusesRoutes(fastify) {
  // GET /api/bonuses?period=YYYY-MM
  fastify.get('/api/bonuses', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    const { rows } = await db.query(
      `SELECT * FROM bonuses WHERE institution_code = $1 AND period = $2 ORDER BY emp_id`,
      [req.institution, period]
    );
    return rows.map(dbToClient);
  });

  // POST /api/bonuses?period=YYYY-MM — upsert single
  fastify.post('/api/bonuses', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    if (!req.body.empId) return reply.code(400).send({ error: 'empId required' });
    const client = await db.connect();
    try {
      const row = await upsertBonus(client, req.institution, period, req.body);
      return dbToClient(row);
    } finally {
      client.release();
    }
  });

  // POST /api/bonuses/import?period=YYYY-MM — bulk upsert
  fastify.post('/api/bonuses/import', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    const { bonuses } = req.body;
    if (!period || !Array.isArray(bonuses)) return reply.code(400).send({ error: 'period and bonuses required' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const b of bonuses) {
        await upsertBonus(client, req.institution, period, b);
      }
      await client.query('COMMIT');
      return { count: bonuses.length };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  // DELETE /api/bonuses?period=YYYY-MM — clear all for period
  fastify.delete('/api/bonuses', { preHandler }, async (req, reply) => {
    const { period } = req.query;
    if (!period) return reply.code(400).send({ error: 'period required' });
    await db.query(
      `DELETE FROM bonuses WHERE institution_code = $1 AND period = $2`,
      [req.institution, period]
    );
    return { success: true };
  });
}
