import Fastify, { type FastifyInstance } from 'fastify';
import { registrarRotasDeSala } from './routes/salas.js';
import { registrarRotasDaVez } from './routes/vez.js';
import { registrarRotaDeConsumo } from './routes/consumo.js';

export function criarApp(): FastifyInstance {
  const app = Fastify({ logger: true });
  app.get('/health', async () => ({ ok: true }));
  registrarRotasDeSala(app);
  registrarRotasDaVez(app);
  registrarRotaDeConsumo(app);
  return app;
}
