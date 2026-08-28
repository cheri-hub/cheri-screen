import Fastify, { type FastifyInstance } from 'fastify';
import { registrarRotasDeSala } from './routes/salas.js';

export function criarApp(): FastifyInstance {
  const app = Fastify({ logger: true });
  app.get('/health', async () => ({ ok: true }));
  registrarRotasDeSala(app);
  return app;
}
