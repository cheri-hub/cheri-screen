import {
  ESPERA_MS,
  type Decisao,
  type EstadoDaVez,
  type Evento,
  type Resultado,
} from './types.js';

/** Descarta dono e pedido de quem não está mais na sala. */
function normalizar(estado: EstadoDaVez, presentes: readonly string[]): EstadoDaVez {
  return {
    sharer:
      estado.sharer && presentes.includes(estado.sharer.identity)
        ? estado.sharer
        : null,
    pending:
      estado.pending && presentes.includes(estado.pending.identity)
        ? estado.pending
        : null,
  };
}

function conceder(
  estado: EstadoDaVez,
  identity: string,
  nome: string,
  agora: number,
): Resultado {
  const revogarDe = estado.sharer?.identity ?? null;
  return {
    estado: { sharer: { identity, nome, desde: agora }, pending: null },
    decisao: { resultado: 'concedido', para: identity, revogarDe },
  };
}

function ignorar(estado: EstadoDaVez, motivo: string): Resultado {
  return { estado, decisao: { resultado: 'ignorado', motivo } as Decisao };
}

function pedir(
  estado: EstadoDaVez,
  agora: number,
  ev: Extract<Evento, { tipo: 'pedir' }>,
): Resultado {
  if (!estado.sharer) return conceder(estado, ev.identity, ev.nome, agora);
  if (estado.sharer.identity === ev.identity) return ignorar(estado, 'ja-e-o-dono');

  const pend = estado.pending;

  if (pend?.identity === ev.identity) {
    // Silêncio cede a vez: o pedido do próprio solicitante venceu sem resposta.
    return pend.expiraEm <= agora
      ? conceder(estado, ev.identity, ev.nome, agora)
      : { estado, decisao: { resultado: 'aguardando', dono: estado.sharer.identity } };
  }

  if (pend && pend.expiraEm > agora) {
    return { estado, decisao: { resultado: 'ocupado' } };
  }

  return {
    estado: {
      ...estado,
      pending: { identity: ev.identity, nome: ev.nome, expiraEm: agora + ESPERA_MS },
    },
    decisao: { resultado: 'aguardando', dono: estado.sharer.identity },
  };
}

function responder(
  estado: EstadoDaVez,
  agora: number,
  ev: Extract<Evento, { tipo: 'responder' }>,
): Resultado {
  if (estado.sharer?.identity !== ev.identity) return ignorar(estado, 'nao-e-o-dono');
  if (!estado.pending) return ignorar(estado, 'sem-pedido');
  if (estado.pending.expiraEm <= agora) {
    return {
      estado: { ...estado, pending: null },
      decisao: { resultado: 'ignorado', motivo: 'pedido-expirado' },
    };
  }
  if (!ev.aceita) {
    return { estado: { ...estado, pending: null }, decisao: { resultado: 'recusado' } };
  }
  return conceder(estado, estado.pending.identity, estado.pending.nome, agora);
}

function liberar(
  estado: EstadoDaVez,
  agora: number,
  ev: Extract<Evento, { tipo: 'liberar' }>,
): Resultado {
  if (estado.sharer?.identity !== ev.identity) return ignorar(estado, 'nao-e-o-dono');
  const pend = estado.pending;
  // Quem esperava a vez não pode ficar no silêncio: se há pedido vivo, a vez
  // liberada passa direto pra ele em vez de a sala esvaziar.
  if (pend && pend.expiraEm > agora) {
    return conceder(estado, pend.identity, pend.nome, agora);
  }
  return {
    estado: { sharer: null, pending: null },
    decisao: { resultado: 'liberado', revogarDe: ev.identity },
  };
}

export function decide(
  estado: EstadoDaVez,
  presentes: readonly string[],
  agora: number,
  evento: Evento,
): Resultado {
  const base = normalizar(estado, presentes);
  switch (evento.tipo) {
    case 'pedir':
      return pedir(base, agora, evento);
    case 'responder':
      return responder(base, agora, evento);
    case 'liberar':
      return liberar(base, agora, evento);
  }
}
