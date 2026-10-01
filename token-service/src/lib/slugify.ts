export const TAMANHO_MIN = 3;
export const TAMANHO_MAX = 40;

/**
 * Converte um nome livre num slug URL-safe: ele vira o id da sala, então
 * nomes diferentes que colapsam no mesmo slug (`"Festa!"` e `"festa"`) caem
 * de propósito na mesma sala — é a semântica "cria ou entra" por nome.
 */
export function slugify(bruto: string): string {
  return bruto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, TAMANHO_MAX)
    .replace(/-+$/g, '');
}
