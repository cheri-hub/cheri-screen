export type Contador = { mes: string; bytes: number; ultimaLeitura: number | null };

export const CONTADOR_VAZIO: Contador = { mes: '', bytes: 0, ultimaLeitura: null };

export function acumular(atual: Contador, leitura: number, agora: Date): Contador {
  const mes = agora.toISOString().slice(0, 7);
  if (atual.mes !== mes) return { mes, bytes: 0, ultimaLeitura: leitura };
  if (atual.ultimaLeitura === null) return { ...atual, ultimaLeitura: leitura };

  const delta = leitura - atual.ultimaLeitura;
  // Contador Prometheus zerou (LiveKit reiniciou): reancora sem somar o salto.
  if (delta < 0) return { ...atual, ultimaLeitura: leitura };

  return { mes, bytes: atual.bytes + delta, ultimaLeitura: leitura };
}
