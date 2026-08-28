import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRoom = {
  listRooms: vi.fn(),
  listParticipants: vi.fn(),
  updateParticipant: vi.fn(),
  updateRoomMetadata: vi.fn(),
};
vi.mock('../livekit.js', () => ({ api: { room: mockRoom } }));

const { aplicar } = await import('./aplicar.js');

const SALA = 'sala-1';

describe('aplicar', () => {
  beforeEach(() => {
    Object.values(mockRoom).forEach((m) => m.mockReset());
    mockRoom.updateParticipant.mockResolvedValue({});
    mockRoom.updateRoomMetadata.mockResolvedValue({});
  });

  it('devolve null quando a sala não existe', async () => {
    mockRoom.listRooms.mockResolvedValue([]);
    const r = await aplicar(SALA, { tipo: 'pedir', identity: 'ana', nome: 'Ana' });
    expect(r).toBeNull();
  });

  it('liga canPublish para quem recebe a vez e grava a metadata', async () => {
    mockRoom.listRooms.mockResolvedValue([{ name: SALA, metadata: '' }]);
    mockRoom.listParticipants.mockResolvedValue([{ identity: 'ana' }]);

    const decisao = await aplicar(SALA, {
      tipo: 'pedir', identity: 'ana', nome: 'Ana',
    });

    expect(decisao).toEqual({ resultado: 'concedido', para: 'ana', revogarDe: null });
    expect(mockRoom.updateParticipant).toHaveBeenCalledWith(
      SALA,
      'ana',
      { permission: { canSubscribe: true, canPublish: true, canPublishData: true } },
    );
    const [, metadata] = mockRoom.updateRoomMetadata.mock.calls[0];
    expect(JSON.parse(metadata).sharer.identity).toBe('ana');
  });

  it('revoga canPublish de quem perdeu a vez', async () => {
    const estado = {
      sharer: { identity: 'ana', nome: 'Ana', desde: 0 },
      pending: { identity: 'pedro', nome: 'Pedro', expiraEm: Date.now() + 10_000 },
    };
    mockRoom.listRooms.mockResolvedValue([
      { name: SALA, metadata: JSON.stringify(estado) },
    ]);
    mockRoom.listParticipants.mockResolvedValue([
      { identity: 'ana' }, { identity: 'pedro' },
    ]);

    await aplicar(SALA, { tipo: 'responder', identity: 'ana', aceita: true });

    expect(mockRoom.updateParticipant).toHaveBeenCalledWith(
      SALA,
      'ana',
      { permission: { canSubscribe: true, canPublish: false, canPublishData: true } },
    );
  });

  it('trata metadata corrompida como estado vazio', async () => {
    mockRoom.listRooms.mockResolvedValue([{ name: SALA, metadata: 'não é json' }]);
    mockRoom.listParticipants.mockResolvedValue([{ identity: 'ana' }]);

    const decisao = await aplicar(SALA, {
      tipo: 'pedir', identity: 'ana', nome: 'Ana',
    });

    expect(decisao?.resultado).toBe('concedido');
  });

  it('responde 403 quando quem responde não detém a vez', async () => {
    const estado = {
      sharer: { identity: 'ana', nome: 'Ana', desde: 0 },
      pending: { identity: 'pedro', nome: 'Pedro', expiraEm: Date.now() + 10_000 },
    };
    mockRoom.listRooms.mockResolvedValue([
      { name: SALA, metadata: JSON.stringify(estado) },
    ]);
    mockRoom.listParticipants.mockResolvedValue([
      { identity: 'ana' }, { identity: 'pedro' },
    ]);

    const { criarApp } = await import('../app.js');
    const app = criarApp();
    const r = await app.inject({
      method: 'POST',
      url: `/rooms/${SALA}/floor/answer`,
      payload: { identity: 'pedro', aceita: true },
    });

    expect(r.statusCode).toBe(403);
    expect(r.json()).toEqual({ erro: 'nao-e-o-dono' });
  });
});
