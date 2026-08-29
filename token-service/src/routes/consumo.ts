import type { FastifyInstance } from 'fastify';
import { consumoAtual } from '../usage/coletor.js';

export function registrarRotaDeConsumo(app: FastifyInstance): void {
  app.get('/usage', async () => {
    const { mes, bytes } = consumoAtual();
    return { mes, bytes };
  });
}
