export const TAMANHO_MIN = 3
export const TAMANHO_MAX = 40

/**
 * Espelha token-service/src/lib/slugify.ts — só pra mostrar a prévia do id
 * antes de criar a sala. A fonte da verdade é o servidor.
 */
export function slugify(bruto: string): string {
  return bruto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, TAMANHO_MAX)
    .replace(/-+$/g, '')
}
