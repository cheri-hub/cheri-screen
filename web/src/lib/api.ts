export type TokenResposta = { token: string; wsUrl: string }

async function post<T>(caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`/api${caminho}`, {
    method: 'POST',
    ...(corpo === undefined
      ? {}
      : {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(corpo),
        }),
  })
  if (!r.ok) throw Object.assign(new Error('falha'), { status: r.status })
  return r.json() as Promise<T>
}

export const criarSala = () =>
  post<{ id: string }>('/rooms').then((r) => r.id)

export const pedirToken = (sala: string, identity: string, apelido: string) =>
  post<TokenResposta>(`/rooms/${sala}/token`, { identity, apelido })

export type Decisao =
  | { resultado: 'concedido'; para: string; revogarDe: string | null }
  | { resultado: 'aguardando'; dono: string }
  | { resultado: 'ocupado' }
  | { resultado: 'recusado' }
  | { resultado: 'liberado'; revogarDe: string }
  | { resultado: 'ignorado'; motivo: string }

export const pedirVez = (sala: string, identity: string, nome: string) =>
  post<{ decisao: Decisao }>(`/rooms/${sala}/floor/request`, { identity, nome })

export const responderVez = (sala: string, identity: string, aceita: boolean) =>
  post<{ decisao: Decisao }>(`/rooms/${sala}/floor/answer`, { identity, aceita })

export const liberarVez = (sala: string, identity: string) =>
  post<{ decisao: Decisao }>(`/rooms/${sala}/floor/release`, { identity })
