import type { FastifyInstance, FastifyReply } from 'fastify';
import { aplicar } from '../floor/aplicar.js';
import type { Evento } from '../floor/types.js';

type Params = { id: string };

export function registrarRotasDaVez(app: FastifyInstance): void {
  async function resolver(salaId: string, evento: Evento, reply: FastifyReply) {
    const decisao = await aplicar(salaId, evento);
    if (!decisao) return reply.code(404).send({ erro: 'sala-inexistente' });
    // Spec §6.4: responder ou liberar sem deter a vez é 403, não sucesso silencioso.
    if (decisao.resultado === 'ignorado' && decisao.motivo === 'nao-e-o-dono') {
      return reply.code(403).send({ erro: 'nao-e-o-dono' });
    }
    return { decisao };
  }

  app.post<{ Params: Params; Body: { identity: string; nome: string } }>(
    '/rooms/:id/floor/request',
    (req, reply) =>
      resolver(
        req.params.id,
        { tipo: 'pedir', identity: req.body.identity, nome: req.body.nome },
        reply,
      ),
  );

  app.post<{ Params: Params; Body: { identity: string; aceita: boolean } }>(
    '/rooms/:id/floor/answer',
    (req, reply) =>
      resolver(
        req.params.id,
        { tipo: 'responder', identity: req.body.identity, aceita: req.body.aceita },
        reply,
      ),
  );

  app.post<{ Params: Params; Body: { identity: string } }>(
    '/rooms/:id/floor/release',
    (req, reply) =>
      resolver(req.params.id, { tipo: 'liberar', identity: req.body.identity }, reply),
  );
}
