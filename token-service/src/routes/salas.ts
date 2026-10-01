import type { FastifyInstance } from 'fastify';
import { AccessToken } from 'livekit-server-sdk';
import { api } from '../livekit.js';
import { config } from '../config.js';
import { TAMANHO_MIN, slugify } from '../lib/slugify.js';

const EMPTY_TIMEOUT = 300;
const MAX_PARTICIPANTES = 10;

export async function salaExiste(id: string): Promise<boolean> {
  const salas = await api.room.listRooms([id]);
  return salas.length > 0;
}

export function registrarRotasDeSala(app: FastifyInstance): void {
  app.post<{ Body: { nome?: string } }>('/rooms', async (req, reply) => {
    const bruto = typeof req.body?.nome === 'string' ? req.body.nome : '';
    const id = slugify(bruto);
    if (id.length < TAMANHO_MIN) {
      return reply.code(400).send({ erro: 'nome-invalido' });
    }
    try {
      await api.room.createRoom({
        name: id,
        emptyTimeout: EMPTY_TIMEOUT,
        maxParticipants: MAX_PARTICIPANTES,
      });
    } catch (erro) {
      // LiveKit cria-ou-devolve ao repetir um nome, mas se algum dia isso
      // mudar, só engolimos o erro quando a sala já existe de fato.
      if (!(await salaExiste(id))) throw erro;
    }
    return { id };
  });

  app.post<{
    Params: { id: string };
    Body: { identity: string; apelido: string };
  }>('/rooms/:id/token', async (req, reply) => {
    const { id } = req.params;
    const { identity, apelido } = req.body ?? {};

    if (!identity || !apelido) {
      return reply.code(400).send({ erro: 'dados-incompletos' });
    }
    if (!(await salaExiste(id))) {
      return reply.code(404).send({ erro: 'sala-inexistente' });
    }

    const at = new AccessToken(config.apiKey, config.apiSecret, {
      identity,
      name: apelido,
      ttl: '4h',
    });
    at.addGrant({
      roomJoin: true,
      room: id,
      canSubscribe: true,
      canPublish: false,
      canPublishData: true,
    });

    return { token: await at.toJwt(), wsUrl: `wss://${config.publicHost}` };
  });
}
