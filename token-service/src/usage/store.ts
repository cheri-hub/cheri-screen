import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { CONTADOR_VAZIO, type Contador } from './acumular.js';

/** Um JSON qualquer no arquivo não pode virar `Contador` sem checagem: `null`
 *  ou lixo travaria `acumular` a cada tick e derrubaria `GET /usage`. */
function ehContador(valor: unknown): valor is Contador {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as Contador).bytes === 'number' &&
    typeof (valor as Contador).mes === 'string'
  );
}

export async function carregar(caminho: string): Promise<Contador> {
  try {
    const bruto: unknown = JSON.parse(await readFile(caminho, 'utf8'));
    return ehContador(bruto) ? bruto : CONTADOR_VAZIO;
  } catch {
    return CONTADOR_VAZIO;
  }
}

export async function salvar(caminho: string, contador: Contador): Promise<void> {
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, JSON.stringify(contador), 'utf8');
}
