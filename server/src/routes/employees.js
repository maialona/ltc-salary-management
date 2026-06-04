import { verifyToken } from '../middleware/verifyToken.js';
import { institutionScope } from '../middleware/institutionScope.js';
import { db } from '../db.js';

const preHandler = [verifyToken, institutionScope];

const empBody = {
  type: 'object',
  required: ['empId', 'name'],
  properties: {
    empId:           { type: 'string', minLength: 1 },
    name:            { type: 'string', minLength: 1 },
    idNumber:        { type: 'string' },
    position:        { type: 'string' },
    paymentMethod:   { type: 'string' },
    bankCode:        { type: 'string' },
    bankAccount:     { type: 'string' },
    splits:          { type: 'object' },
    laborInsuranceBracket:    { type: 'number' },
    laborInsuranceSelfPay:    { type: 'number' },
    healthInsuranceBracket:   { type: 'number' },
    healthDependents:         { type: 'number' },
    healthInsuranceSelfPay:   { type: 'number' },
    voluntaryPensionRate:     { type: 'number' },
    voluntaryPensionDeduction:{ type: 'number' },
    dependentsCount:          { type: 'number' },
    isSupport:                { type: 'boolean' },
  },
  additionalProperties: true,
};

// DB 列 → 前端物件
function dbToClient(row) {
  return {
    id: row.id,
    empId: row.emp_id,
    name: row.name,
    idNumber: row.id_number || '',
    position: row.position,
    organization: row.institution_code, // 前端欄位名保留 organization，值改為 institution code
    paymentMethod: row.payment_method,
    bankCode: row.bank_code || '',
    bankAccount: row.bank_account || '',
    splits: row.splits || { b: 0, g: 0, s: 0, missed: 0, aa09: 0 },
    laborInsuranceBracket: parseFloat(row.labor_insurance_bracket) || 0,
    laborInsuranceSelfPay: parseFloat(row.labor_insurance_self_pay) || 0,
    healthInsuranceBracket: parseFloat(row.health_insurance_bracket) || 0,
    healthDependents: parseFloat(row.health_dependents) || 0,
    healthInsuranceSelfPay: parseFloat(row.health_insurance_self_pay) || 0,
    voluntaryPensionRate: parseFloat(row.voluntary_pension_rate) || 0,
    voluntaryPensionDeduction: parseFloat(row.voluntary_pension_deduction) || 0,
    dependentsCount: parseFloat(row.dependents_count) || 0,
    isSupport: row.is_support ?? false,
  };
}

// 前端物件 → DB 欄位
function clientToDbParams(emp, institutionCode) {
  return [
    institutionCode,
    String(emp.empId || '').trim(),
    String(emp.name || '').trim(),
    emp.idNumber || null,
    emp.position || 'Full-time',
    emp.paymentMethod || '匯款',
    emp.bankCode || null,
    emp.bankAccount || null,
    JSON.stringify(emp.splits || { b: 0, g: 0, s: 0, missed: 0, aa09: 0 }),
    emp.laborInsuranceBracket || 0,
    emp.laborInsuranceSelfPay || 0,
    emp.healthInsuranceBracket || 0,
    emp.healthDependents || 0,
    emp.healthInsuranceSelfPay || 0,
    emp.voluntaryPensionRate || 0,
    emp.voluntaryPensionDeduction || 0,
    emp.dependentsCount || 0,
    emp.isSupport ?? false,
  ];
}

export async function employeesRoutes(fastify) {
  // 列出員工
  fastify.get('/api/employees', { preHandler }, async (request) => {
    const { rows } = await db.query(
      'SELECT * FROM employees WHERE institution_code = $1 ORDER BY emp_id',
      [request.institution]
    );
    return rows.map(dbToClient);
  });

  // 新增員工
  fastify.post('/api/employees', { preHandler, schema: { body: empBody } }, async (request, reply) => {
    const emp = request.body ?? {};
    if (!emp.empId || !emp.name) {
      return reply.code(400).send({ error: 'empId and name are required' });
    }
    const params = clientToDbParams(emp, request.institution);
    try {
      const { rows } = await db.query(
        `INSERT INTO employees
           (institution_code, emp_id, name, id_number, position, payment_method,
            bank_code, bank_account, splits,
            labor_insurance_bracket, labor_insurance_self_pay,
            health_insurance_bracket, health_dependents, health_insurance_self_pay,
            voluntary_pension_rate, voluntary_pension_deduction, dependents_count, is_support)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING *`,
        params
      );
      return reply.code(201).send(dbToClient(rows[0]));
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: `員工編號 ${emp.empId} 已存在` });
      throw err;
    }
  });

  // 更新員工
  fastify.put('/api/employees/:id', { preHandler, schema: { body: empBody } }, async (request, reply) => {
    const { id } = request.params;
    const emp = request.body ?? {};

    // 確認此員工屬於目前機構
    const { rows: existing } = await db.query(
      'SELECT id FROM employees WHERE id = $1 AND institution_code = $2',
      [id, request.institution]
    );
    if (!existing.length) return reply.code(404).send({ error: 'Employee not found' });

    const params = [...clientToDbParams(emp, request.institution), id];
    const { rows } = await db.query(
      `UPDATE employees SET
         institution_code=$1, emp_id=$2, name=$3, id_number=$4, position=$5,
         payment_method=$6, bank_code=$7, bank_account=$8, splits=$9,
         labor_insurance_bracket=$10, labor_insurance_self_pay=$11,
         health_insurance_bracket=$12, health_dependents=$13, health_insurance_self_pay=$14,
         voluntary_pension_rate=$15, voluntary_pension_deduction=$16, dependents_count=$17,
         is_support=$18, updated_at=now()
       WHERE id=$19
       RETURNING *`,
      params
    );
    return dbToClient(rows[0]);
  });

  // 刪除單一員工
  fastify.delete('/api/employees/:id', { preHandler }, async (request, reply) => {
    const { id } = request.params;
    const { rows } = await db.query(
      'DELETE FROM employees WHERE id = $1 AND institution_code = $2 RETURNING id',
      [id, request.institution]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Employee not found' });
    return reply.code(204).send();
  });

  // 清空機構員工
  fastify.delete('/api/employees', { preHandler }, async (request, reply) => {
    await db.query('DELETE FROM employees WHERE institution_code = $1', [request.institution]);
    return reply.code(204).send();
  });

  // 批次匯入（upsert by institution_code + emp_id）
  fastify.post('/api/employees/import', { preHandler }, async (request, reply) => {
    const { employees = [] } = request.body ?? {};
    if (!Array.isArray(employees) || employees.length === 0) {
      return reply.code(400).send({ error: 'employees array is required' });
    }

    const client = await db.connect();
    let newCount = 0;
    try {
      await client.query('BEGIN');
      for (const emp of employees) {
        if (!emp.empId || !emp.name) continue;
        const params = clientToDbParams(emp, request.institution);
        const { rows } = await client.query(
          `INSERT INTO employees
             (institution_code, emp_id, name, id_number, position, payment_method,
              bank_code, bank_account, splits,
              labor_insurance_bracket, labor_insurance_self_pay,
              health_insurance_bracket, health_dependents, health_insurance_self_pay,
              voluntary_pension_rate, voluntary_pension_deduction, dependents_count, is_support)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (institution_code, emp_id) DO UPDATE SET
             name=EXCLUDED.name, id_number=EXCLUDED.id_number,
             position=EXCLUDED.position, payment_method=EXCLUDED.payment_method,
             bank_code=EXCLUDED.bank_code, bank_account=EXCLUDED.bank_account,
             splits=EXCLUDED.splits,
             labor_insurance_bracket=EXCLUDED.labor_insurance_bracket,
             labor_insurance_self_pay=EXCLUDED.labor_insurance_self_pay,
             health_insurance_bracket=EXCLUDED.health_insurance_bracket,
             health_dependents=EXCLUDED.health_dependents,
             health_insurance_self_pay=EXCLUDED.health_insurance_self_pay,
             voluntary_pension_rate=EXCLUDED.voluntary_pension_rate,
             voluntary_pension_deduction=EXCLUDED.voluntary_pension_deduction,
             dependents_count=EXCLUDED.dependents_count,
             is_support=EXCLUDED.is_support,
             updated_at=now()
           RETURNING (xmax = 0) AS is_insert`,
          params
        );
        if (rows[0]?.is_insert) newCount++;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return { count: newCount, total: employees.length };
  });
}
