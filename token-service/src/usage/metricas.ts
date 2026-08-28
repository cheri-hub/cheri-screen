export function lerMetrica(texto: string, nome: string): number | null {
  const linhas = texto
    .split('\n')
    .filter((l) => l.startsWith(nome) && !l.startsWith('#'));
  if (linhas.length === 0) return null;

  return linhas.reduce((total, linha) => {
    const valor = Number(linha.trim().split(/\s+/).at(-1));
    return Number.isFinite(valor) ? total + valor : total;
  }, 0);
}

export async function buscarMetricas(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`métricas indisponíveis: ${r.status}`);
  return r.text();
}
