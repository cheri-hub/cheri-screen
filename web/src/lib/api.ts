export type TokenResposta = { token: string; wsUrl: string }

async function post<T>(caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`/api${caminho}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  if (!r.ok) throw Object.assign(new Error('falha'), { status: r.status })
  return r.json() as Promise<T>
}

export const criarSala = () =>
  post<{ id: string }>('/rooms').then((r) => r.id)

export const pedirToken = (sala: string, identity: string, apelido: string) =>
  post<TokenResposta>(`/rooms/${sala}/token`, { identity, apelido })
