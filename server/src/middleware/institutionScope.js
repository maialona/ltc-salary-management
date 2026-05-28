import { isValidInstitutionCode } from '../lib/institutions.js';

export async function institutionScope(request, reply) {
  const user = request.user;
  const queryInstitution = request.query.institution;

  if (user.role === 'admin') {
    if (!queryInstitution) {
      return reply.code(400).send({ error: 'Admin must specify ?institution=' });
    }
    if (!isValidInstitutionCode(queryInstitution)) {
      return reply.code(400).send({ error: `Invalid institution code: ${queryInstitution}` });
    }
    request.institution = queryInstitution;
  } else {
    // 機構使用者：只能存取自己被授權的機構
    const allowed = user.institution_codes ?? [];
    if (queryInstitution) {
      if (!allowed.includes(queryInstitution)) {
        return reply.code(403).send({ error: 'Access denied to this institution' });
      }
      request.institution = queryInstitution;
    } else {
      request.institution = allowed[0];
    }
  }
}
