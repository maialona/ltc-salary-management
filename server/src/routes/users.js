import { verifyToken } from '../middleware/verifyToken.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { db } from '../db.js';
import { isValidInstitutionCode } from '../lib/institutions.js';

const preHandler = [verifyToken, requireAdmin];

export async function usersRoutes(fastify) {
  // 列出所有使用者
  fastify.get('/api/users', { preHandler }, async () => {
    const { rows } = await db.query(
      'SELECT id, email, role, institution_code, display_name, disabled, created_at FROM users ORDER BY created_at'
    );
    return rows;
  });

  // 新增使用者
  fastify.post('/api/users', { preHandler }, async (request, reply) => {
    const { email, role, institution_code, display_name } = request.body ?? {};

    if (!email || !role) {
      return reply.code(400).send({ error: 'email and role are required' });
    }
    if (!['admin', 'institution_user'].includes(role)) {
      return reply.code(400).send({ error: 'role must be admin or institution_user' });
    }
    if (role === 'institution_user') {
      if (!institution_code) return reply.code(400).send({ error: 'institution_code required for institution_user' });
      if (!isValidInstitutionCode(institution_code)) return reply.code(400).send({ error: `Invalid institution_code: ${institution_code}` });
    }
    if (role === 'admin' && institution_code) {
      return reply.code(400).send({ error: 'admin cannot have institution_code' });
    }

    try {
      const { rows } = await db.query(
        `INSERT INTO users (email, role, institution_code, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, role, institution_code, display_name, disabled, created_at`,
        [email.toLowerCase(), role, institution_code ?? null, display_name ?? null]
      );
      return reply.code(201).send(rows[0]);
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Email already exists' });
      throw err;
    }
  });

  // 更新使用者（role / institution_code / disabled / display_name）
  fastify.put('/api/users/:id', { preHandler }, async (request, reply) => {
    const { id } = request.params;
    const { role, institution_code, display_name, disabled } = request.body ?? {};

    const { rows: existing } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!existing.length) return reply.code(404).send({ error: 'User not found' });

    const user = existing[0];
    const newRole = role ?? user.role;
    const newInstitution = institution_code !== undefined ? institution_code : user.institution_code;
    const newDisplayName = display_name !== undefined ? display_name : user.display_name;
    const newDisabled = disabled !== undefined ? disabled : user.disabled;

    if (newRole === 'institution_user' && !newInstitution) {
      return reply.code(400).send({ error: 'institution_code required for institution_user' });
    }
    if (newRole === 'admin' && newInstitution) {
      return reply.code(400).send({ error: 'admin cannot have institution_code' });
    }
    if (newRole === 'institution_user' && newInstitution && !isValidInstitutionCode(newInstitution)) {
      return reply.code(400).send({ error: `Invalid institution_code: ${newInstitution}` });
    }

    const { rows } = await db.query(
      `UPDATE users SET role=$1, institution_code=$2, display_name=$3, disabled=$4, updated_at=now()
       WHERE id=$5
       RETURNING id, email, role, institution_code, display_name, disabled, created_at`,
      [newRole, newRole === 'admin' ? null : newInstitution, newDisplayName, newDisabled, id]
    );
    return rows[0];
  });

  // 軟刪除（disabled=true）
  fastify.delete('/api/users/:id', { preHandler }, async (request, reply) => {
    const { id } = request.params;
    // 不允許 admin 刪除自己
    if (id === request.user.id) {
      return reply.code(400).send({ error: 'Cannot disable your own account' });
    }
    const { rows } = await db.query(
      `UPDATE users SET disabled=true, updated_at=now() WHERE id=$1
       RETURNING id, email, disabled`,
      [id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'User not found' });
    return rows[0];
  });
}
