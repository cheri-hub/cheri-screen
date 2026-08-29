import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRoom = {
  createRoom: vi.fn(),
  listRooms: vi.fn(),
};
vi.mock('../livekit.js', () => ({ api: { room: mockRoom } }));

const { criarApp } = await import('../app.js');

describe('rotas de sala', () => {
  beforeEach(() => {
    mockRoom.createRoom.mockReset();
    mockRoom.listRooms.mockReset();
  });

  it('cria a sala com empty_timeout de 300s e devolve o id', async () => {
    mockRoom.createRoom.mockResolvedValue({});
    const app = criarApp();

    const r = await app.inject({ method: 'POST', url: '/rooms' });

    expect(r.statusCode).toBe(200);
    const { id } = r.json();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mockRoom.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ name: id, emptyTimeout: 300, maxParticipants: 10 }),
    );
  });

  it('responde 404 quando a sala não existe', async () => {
    mockRoom.listRooms.mockResolvedValue([]);
    const app = criarApp();

    const r = await app.inject({
      method: 'POST',
      url: '/rooms/00000000-0000-4000-8000-000000000000/token',
      payload: { identity: 'i1', apelido: 'Ana' },
    });

    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ erro: 'sala-inexistente' });
  });

  it('emite token sem permissão de publicar', async () => {
    const sala = '00000000-0000-4000-8000-000000000000';
    mockRoom.listRooms.mockResolvedValue([{ name: sala }]);
    const app = criarApp();

    const r = await app.inject({
      method: 'POST',
      url: `/rooms/${sala}/token`,
      payload: { identity: 'i1', apelido: 'Ana' },
    });

    expect(r.statusCode).toBe(200);
    const { token, wsUrl } = r.json();
    const grant = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString(),
    );
    expect(grant.video.canPublish).toBe(false);
    expect(grant.video.canSubscribe).toBe(true);
    expect(grant.video.room).toBe(sala);
    // livekit-client anexa o próprio segmento /rtc ao conectar; o token
    // devolve só a origem para não gerar wss://host/rtc/rtc/...
    expect(wsUrl).toBe('wss://test.local');
  });
});
