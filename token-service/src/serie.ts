const filas = new Map<string, Promise<unknown>>();

/** Executa `fn` em série por chave, mesmo que a anterior tenha falhado. */
export function emSerie<T>(chave: string, fn: () => Promise<T>): Promise<T> {
  const anterior = filas.get(chave) ?? Promise.resolve();
  const proximo = anterior.then(fn, fn);
  filas.set(
    chave,
    proximo.catch(() => undefined),
  );
  return proximo;
}
