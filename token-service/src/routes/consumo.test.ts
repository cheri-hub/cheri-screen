import { describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';

describe('GET /usage', () => {
  it('responde { mes, bytes } mesmo sem arquivo de contador e sem coleta', async () => {
    const app = criarApp();
    const resposta = await app.inject({ method: 'GET', url: '/usage' });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.payload) as { mes: string; bytes: number };
    expect(typeof corpo.mes).toBe('string');
    expect(corpo.bytes).toBe(0);

    await app.close();
  });
});
