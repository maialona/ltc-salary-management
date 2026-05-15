import { verifyToken } from '../middleware/verifyToken.js';

export async function meRoutes(fastify) {
  fastify.get('/api/me', { preHandler: verifyToken }, async (request) => {
    const { id, email, role, institution_code, display_name } = request.user;
    return { id, email, role, institution_code, display_name };
  });
}
