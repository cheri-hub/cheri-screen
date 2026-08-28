import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { AccessToken } from 'livekit-server-sdk';
import { api } from '../livekit.js';
import { config } from '../config.js';

const EMPTY_TIMEOUT = 300;
const MAX_PARTICIPANTES = 10;

export async function salaExiste(id: string): Promise<boolean> {
  const salas = await api.room.listRooms([id]);
  return salas.length > 0;
}

export function registrarRotasDeSala(app: FastifyInstance): void {
  app.post('/rooms', async () => {
    const id = randomUUID();
    await api.room.createRoom({
      name: id,
      emptyTimeout: EMPTY_TIMEOUT,
      maxParticipants: MAX_PARTICIPANTES,
    });
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

    return { token: await at.toJwt(), wsUrl: `wss://${config.publicHost}/rtc` };
  });
}
