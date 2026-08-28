import Fastify, { type FastifyInstance } from 'fastify';

export function criarApp(): FastifyInstance {
  const app = Fastify({ logger: true });
  app.get('/health', async () => ({ ok: true }));
  return app;
}
