import { describe, it, expect } from 'vitest';
import { criarApp } from './app.js';

describe('criarApp', () => {
  it('responde com ok no endpoint /health', async () => {
    const app = criarApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toEqual({ ok: true });
    await app.close();
  });
});
