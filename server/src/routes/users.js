import { verifyToken } from '../middleware/verifyToken.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { db } from '../db.js';
import { isValidInstitutionCodes } from '../lib/institutions.js';

const preHandler = [verifyToken, requireAdmin];

export async function usersRoutes(fastify) {
  // 列出所有使用者
  fastify.get('/api/users', { preHandler }, async () => {
    const { rows } = await db.query(
      'SELECT id, email, role, institution_codes, display_name, disabled, created_at FROM users ORDER BY created_at'
    );
    return rows;
  });

  // 新增使用者
  fastify.post('/api/users', { preHandler }, async (request, reply) => {
    const { email, role, institution_codes, display_name } = request.body ?? {};

    if (!email || !role) {
      return reply.code(400).send({ error: 'email and role are required' });
    }
    if (!['admin', 'institution_user'].includes(role)) {
      return reply.code(400).send({ error: 'role must be admin or institution_user' });
    }
    if (role === 'institution_user') {
      if (!institution_codes || !institution_codes.length) {
        return reply.code(400).send({ error: 'institution_codes required for institution_user' });
      }
      if (!isValidInstitutionCodes(institution_codes)) {
        return reply.code(400).send({ error: `Invalid institution_codes: ${institution_codes}` });
      }
    }
    if (role === 'admin' && institution_codes?.length) {
      return reply.code(400).send({ error: 'admin cannot have institution_codes' });
    }

    try {
      const { rows } = await db.query(
        `INSERT INTO users (email, role, institution_codes, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, role, institution_codes, display_name, disabled, created_at`,
        [email.toLowerCase(), role, role === 'admin' ? [] : institution_codes, display_name ?? null]
      );
      return reply.code(201).send(rows[0]);
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Email already exists' });
      throw err;
    }
  });

  // 更新使用者（role / institution_codes / disabled / display_name）
  fastify.put('/api/users/:id', { preHandler }, async (request, reply) => {
    const { id } = request.params;
    const { role, institution_codes, display_name, disabled } = request.body ?? {};

    const { rows: existing } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!existing.length) return reply.code(404).send({ error: 'User not found' });

    const user = existing[0];
    const newRole = role ?? user.role;
    const newInstitutions = institution_codes !== undefined ? institution_codes : (user.institution_codes ?? []);
    const newDisplayName = display_name !== undefined ? display_name : user.display_name;
    const newDisabled = disabled !== undefined ? disabled : user.disabled;

    if (newRole === 'institution_user' && !newInstitutions.length) {
      return reply.code(400).send({ error: 'institution_codes required for institution_user' });
    }
    if (newRole === 'admin' && newInstitutions.length) {
      return reply.code(400).send({ error: 'admin cannot have institution_codes' });
    }
    if (newRole === 'institution_user' && !isValidInstitutionCodes(newInstitutions)) {
      return reply.code(400).send({ error: `Invalid institution_codes: ${newInstitutions}` });
    }

    const { rows } = await db.query(
      `UPDATE users SET role=$1, institution_codes=$2, display_name=$3, disabled=$4, updated_at=now()
       WHERE id=$5
       RETURNING id, email, role, institution_codes, display_name, disabled, created_at`,
      [newRole, newRole === 'admin' ? [] : newInstitutions, newDisplayName, newDisabled, id]
    );
    return rows[0];
  });

  // 軟刪除（disabled=true）
  fastify.delete('/api/users/:id', { preHandler }, async (request, reply) => {
    const { id } = request.params;
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
