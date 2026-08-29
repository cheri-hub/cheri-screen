import { describe, expect, it, vi } from 'vitest';

vi.mock('../livekit.js', () => ({
  api: { room: { listRooms: vi.fn(), listParticipants: vi.fn() } },
}));

const { criarApp } = await import('../app.js');

const SALA = '00000000-0000-4000-8000-000000000000';

describe('rotas da vez — corpo incompleto', () => {
  it('POST /floor/request sem identity → 400 dados-incompletos', async () => {
    const app = criarApp();
    const r = await app.inject({
      method: 'POST',
      url: `/rooms/${SALA}/floor/request`,
      payload: { nome: 'Pedro' },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json()).toEqual({ erro: 'dados-incompletos' });
  });

  it('POST /floor/request sem corpo → 400 dados-incompletos', async () => {
    const app = criarApp();
    const r = await app.inject({
      method: 'POST',
      url: `/rooms/${SALA}/floor/request`,
    });
    expect(r.statusCode).toBe(400);
  });

  it('POST /floor/answer sem aceita → 400 dados-incompletos', async () => {
    const app = criarApp();
    const r = await app.inject({
      method: 'POST',
      url: `/rooms/${SALA}/floor/answer`,
      payload: { identity: 'pedro' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('POST /floor/release sem identity → 400 dados-incompletos', async () => {
    const app = criarApp();
    const r = await app.inject({
      method: 'POST',
      url: `/rooms/${SALA}/floor/release`,
      payload: {},
    });
    expect(r.statusCode).toBe(400);
  });
});
