import { verifyIdToken } from '../firebase.js';
import { db } from '../db.js';

const INITIAL_ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL;

export async function verifyToken(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing authorization header' });
  }

  const idToken = authHeader.slice(7);
  let decoded;
  try {
    decoded = await verifyIdToken(idToken);
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }

  const { email, name: displayName } = decoded;

  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  let user = rows[0];

  if (!user) {
    // Bootstrap: 第一次用 admin email 登入自動建立 admin row
    if (email === INITIAL_ADMIN_EMAIL) {
      const { rows: inserted } = await db.query(
        `INSERT INTO users (email, role, institution_codes, display_name)
         VALUES ($1, 'admin', '{}', $2)
         RETURNING *`,
        [email, displayName || email]
      );
      user = inserted[0];
    } else {
      return reply.code(403).send({ error: 'NOT_WHITELISTED' });
    }
  } else if (user.disabled) {
    return reply.code(403).send({ error: 'ACCOUNT_DISABLED' });
  }

  // 更新 display_name（Google 顯示名稱可能改變）
  if (displayName && displayName !== user.display_name) {
    await db.query('UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2', [displayName, user.id]);
    user.display_name = displayName;
  }

  request.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    institution_codes: user.institution_codes ?? [],
    display_name: user.display_name,
  };
}
