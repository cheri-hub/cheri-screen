import { describe, expect, it } from 'vitest';
import { decide } from './decide.js';
import { ESPERA_MS, ESTADO_VAZIO, type EstadoDaVez } from './types.js';

const AGORA = 1_000_000;
const ana: EstadoDaVez = {
  sharer: { identity: 'ana', nome: 'Ana', desde: 0 },
  pending: null,
};
const pedir = { tipo: 'pedir', identity: 'pedro', nome: 'Pedro' } as const;

describe('decide — pedir', () => {
  it('concede na hora quando a sala está livre', () => {
    const r = decide(ESTADO_VAZIO, ['pedro'], AGORA, pedir);
    expect(r.decisao).toEqual({ resultado: 'concedido', para: 'pedro', revogarDe: null });
    expect(r.estado.sharer?.identity).toBe('pedro');
  });

  it('concede quando quem tinha a vez não está mais na sala', () => {
    const r = decide(ana, ['pedro'], AGORA, pedir);
    expect(r.decisao).toEqual({ resultado: 'concedido', para: 'pedro', revogarDe: null });
  });

  it('abre pedido quando a sala está ocupada', () => {
    const r = decide(ana, ['ana', 'pedro'], AGORA, pedir);
    expect(r.decisao).toEqual({ resultado: 'aguardando', dono: 'ana' });
    expect(r.estado.pending).toEqual({
      identity: 'pedro', nome: 'Pedro', expiraEm: AGORA + ESPERA_MS,
    });
    expect(r.estado.sharer?.identity).toBe('ana');
  });

  it('recusa um segundo pedido enquanto outro está ativo', () => {
    const comPedido: EstadoDaVez = {
      ...ana,
      pending: { identity: 'joao', nome: 'João', expiraEm: AGORA + 1 },
    };
    const r = decide(comPedido, ['ana', 'joao', 'pedro'], AGORA, pedir);
    expect(r.decisao).toEqual({ resultado: 'ocupado' });
    expect(r.estado).toEqual(comPedido);
  });

  it('cede a vez quando o próprio pedido expirou sem resposta', () => {
    const expirado: EstadoDaVez = {
      ...ana,
      pending: { identity: 'pedro', nome: 'Pedro', expiraEm: AGORA - 1 },
    };
    const r = decide(expirado, ['ana', 'pedro'], AGORA, pedir);
    expect(r.decisao).toEqual({ resultado: 'concedido', para: 'pedro', revogarDe: 'ana' });
    expect(r.estado.pending).toBeNull();
  });

  it('ignora pedido de quem já detém a vez', () => {
    const r = decide(ana, ['ana'], AGORA, {
      tipo: 'pedir', identity: 'ana', nome: 'Ana',
    });
    expect(r.decisao.resultado).toBe('ignorado');
  });
});

describe('decide — responder', () => {
  const comPedido: EstadoDaVez = {
    ...ana,
    pending: { identity: 'pedro', nome: 'Pedro', expiraEm: AGORA + ESPERA_MS },
  };

  it('transfere a vez quando aceito', () => {
    const r = decide(comPedido, ['ana', 'pedro'], AGORA, {
      tipo: 'responder', identity: 'ana', aceita: true,
    });
    expect(r.decisao).toEqual({ resultado: 'concedido', para: 'pedro', revogarDe: 'ana' });
    expect(r.estado.sharer?.identity).toBe('pedro');
    expect(r.estado.pending).toBeNull();
  });

  it('mantém a vez quando recusado', () => {
    const r = decide(comPedido, ['ana', 'pedro'], AGORA, {
      tipo: 'responder', identity: 'ana', aceita: false,
    });
    expect(r.decisao).toEqual({ resultado: 'recusado' });
    expect(r.estado.sharer?.identity).toBe('ana');
    expect(r.estado.pending).toBeNull();
  });

  it('ignora resposta de quem não detém a vez', () => {
    const r = decide(comPedido, ['ana', 'pedro'], AGORA, {
      tipo: 'responder', identity: 'pedro', aceita: true,
    });
    expect(r.decisao).toEqual({ resultado: 'ignorado', motivo: 'nao-e-o-dono' });
  });
});

describe('decide — liberar', () => {
  it('libera a vez de quem a detém', () => {
    const r = decide(ana, ['ana'], AGORA, { tipo: 'liberar', identity: 'ana' });
    expect(r.decisao).toEqual({ resultado: 'liberado', revogarDe: 'ana' });
    expect(r.estado.sharer).toBeNull();
  });

  it('ignora liberação de quem não detém a vez', () => {
    const r = decide(ana, ['ana', 'pedro'], AGORA, { tipo: 'liberar', identity: 'pedro' });
    expect(r.decisao).toEqual({ resultado: 'ignorado', motivo: 'nao-e-o-dono' });
  });

  it('passa a vez direto para quem aguardava quando o dono libera', () => {
    const comPedido: EstadoDaVez = {
      ...ana,
      pending: { identity: 'pedro', nome: 'Pedro', expiraEm: AGORA + ESPERA_MS },
    };
    const r = decide(comPedido, ['ana', 'pedro'], AGORA, {
      tipo: 'liberar', identity: 'ana',
    });
    expect(r.decisao).toEqual({ resultado: 'concedido', para: 'pedro', revogarDe: 'ana' });
    expect(r.estado.sharer?.identity).toBe('pedro');
    expect(r.estado.pending).toBeNull();
  });

  it('esvazia a sala quando o pedido pendente já expirou', () => {
    const comPedidoVelho: EstadoDaVez = {
      ...ana,
      pending: { identity: 'pedro', nome: 'Pedro', expiraEm: AGORA - 1 },
    };
    const r = decide(comPedidoVelho, ['ana', 'pedro'], AGORA, {
      tipo: 'liberar', identity: 'ana',
    });
    expect(r.decisao).toEqual({ resultado: 'liberado', revogarDe: 'ana' });
    expect(r.estado.sharer).toBeNull();
    expect(r.estado.pending).toBeNull();
  });
});
