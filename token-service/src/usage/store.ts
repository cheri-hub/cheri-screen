import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { CONTADOR_VAZIO, type Contador } from './acumular.js';

export async function carregar(caminho: string): Promise<Contador> {
  try {
    return JSON.parse(await readFile(caminho, 'utf8')) as Contador;
  } catch {
    return CONTADOR_VAZIO;
  }
}

export async function salvar(caminho: string, contador: Contador): Promise<void> {
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, JSON.stringify(contador), 'utf8');
}
