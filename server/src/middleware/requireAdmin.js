export async function requireAdmin(request, reply) {
  if (request.user?.role !== 'admin') {
    return reply.code(403).send({ error: 'Admin only' });
  }
}
