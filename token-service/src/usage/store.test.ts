import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { carregar, salvar } from './store.js';
import { CONTADOR_VAZIO } from './acumular.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cheri-store-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('carregar', () => {
  it('arquivo ausente → contador vazio', async () => {
    expect(await carregar(join(dir, 'nao-existe.json'))).toEqual(CONTADOR_VAZIO);
  });

  it('arquivo com lixo → contador vazio', async () => {
    const caminho = join(dir, 'lixo.json');
    await writeFile(caminho, 'isto não é json {', 'utf8');
    expect(await carregar(caminho)).toEqual(CONTADOR_VAZIO);
  });

  it('arquivo com literal null → contador vazio', async () => {
    const caminho = join(dir, 'null.json');
    await writeFile(caminho, 'null', 'utf8');
    expect(await carregar(caminho)).toEqual(CONTADOR_VAZIO);
  });

  it('arquivo com JSON de forma errada → contador vazio', async () => {
    const caminho = join(dir, 'forma.json');
    await writeFile(caminho, JSON.stringify({ foo: 1 }), 'utf8');
    expect(await carregar(caminho)).toEqual(CONTADOR_VAZIO);
  });

  it('arquivo válido volta como foi gravado', async () => {
    const caminho = join(dir, 'sub', 'consumo.json');
    const contador = { mes: '2026-08', bytes: 1234, ultimaLeitura: 1234 };
    await salvar(caminho, contador);
    expect(await carregar(caminho)).toEqual(contador);
  });
});
