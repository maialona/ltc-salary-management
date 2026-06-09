import { verifyToken } from '../middleware/verifyToken.js';
import { institutionScope } from '../middleware/institutionScope.js';
import { db } from '../db.js';

const preHandler = [verifyToken, institutionScope];

export async function analyticsRoutes(fastify) {
  // GET /api/analytics/salary-trend
  // Returns all-period BGS + A code income per employee for the institution.
  fastify.get('/api/analytics/salary-trend', { preHandler }, async (req, reply) => {
    const institution = req.institution;

    const [{ rows: bgsRows }, { rows: acodeRows }] = await Promise.all([
      db.query(
        `SELECT sr.period, e.emp_id, e.name,
           COALESCE(sr.b,0)+COALESCE(sr.g,0)+COALESCE(sr.s,0)+COALESCE(sr.missed,0) AS bgs
         FROM service_records sr
         JOIN employees e ON e.emp_id = sr.emp_id AND e.institution_code = $1
         WHERE sr.institution_code = $1
         ORDER BY sr.period, e.name`,
        [institution]
      ),
      db.query(
        `SELECT period, data FROM acode_results WHERE institution_code = $1`,
        [institution]
      ),
    ]);

    // period → { empId → totalCommission }
    const acodeMap = {};
    for (const row of acodeRows) {
      const summary = row.data?.finalSummary ?? [];
      acodeMap[row.period] = {};
      for (const emp of summary) {
        acodeMap[row.period][emp.id] = emp.totalCommission ?? 0;
      }
    }

    const empMap = {};
    for (const r of bgsRows) {
      if (!empMap[r.emp_id]) empMap[r.emp_id] = { empId: r.emp_id, name: r.name, periods: {} };
      empMap[r.emp_id].periods[r.period] = {
        bgs: parseFloat(r.bgs) || 0,
        acode: acodeMap[r.period]?.[r.emp_id] ?? 0,
      };
    }

    const periods = [...new Set(bgsRows.map(r => r.period))].sort();

    return {
      periods,
      employees: Object.values(empMap).sort((a, b) => a.name.localeCompare(b.name, 'zh-TW')),
    };
  });
}
