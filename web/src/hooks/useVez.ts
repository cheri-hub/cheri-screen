import { useCallback, useRef, useSyncExternalStore } from 'react'
import { Room, RoomEvent } from 'livekit-client'
import { liberarVez, pedirVez, responderVez, type Decisao } from '../lib/api'
import { obterIdentidade } from '../lib/identidade'

export type EstadoDaVez = {
  sharer: { identity: string; nome: string; desde: number } | null
  pending: { identity: string; nome: string; expiraEm: number } | null
}

const VAZIO: EstadoDaVez = { sharer: null, pending: null }

export function lerEstadoDaVez(metadata: string | undefined): EstadoDaVez {
  if (!metadata) return VAZIO
  try {
    const bruto = JSON.parse(metadata) as Partial<EstadoDaVez>
    return { sharer: bruto.sharer ?? null, pending: bruto.pending ?? null }
  } catch {
    return VAZIO
  }
}

export function useVez(room: Room | null, salaId: string) {
  const eu = obterIdentidade()
  const cache = useRef<{ metadata: string | undefined; estado: EstadoDaVez }>({
    metadata: undefined,
    estado: VAZIO,
  })

  const assinar = useCallback(
    (aoMudar: () => void) => {
      if (!room) return () => {}
      room.on(RoomEvent.RoomMetadataChanged, aoMudar)
      return () => {
        room.off(RoomEvent.RoomMetadataChanged, aoMudar)
      }
    },
    [room],
  )

  const obterEstado = useCallback((): EstadoDaVez => {
    const metadata = room?.metadata
    if (cache.current.metadata !== metadata) {
      cache.current = { metadata, estado: lerEstadoDaVez(metadata) }
    }
    return cache.current.estado
  }, [room])

  const estado = useSyncExternalStore(assinar, obterEstado, () => VAZIO)

  const pedir = useCallback(
    (nome: string): Promise<Decisao> =>
      pedirVez(salaId, eu, nome).then((r) => r.decisao),
    [salaId, eu],
  )

  const responder = useCallback(
    (aceita: boolean) => responderVez(salaId, eu, aceita),
    [salaId, eu],
  )

  const liberar = useCallback(() => liberarVez(salaId, eu), [salaId, eu])

  // `estado` é referencialmente estável enquanto a metadata não muda, então
  // `meuPedido` também é — pode entrar em dependências de efeito sem oscilar.
  const meuPedido =
    estado.pending && estado.pending.identity === eu ? estado.pending : null

  return {
    estado,
    souDono: estado.sharer?.identity === eu,
    pedemMinhaVez: estado.sharer?.identity === eu ? estado.pending : null,
    meuPedido,
    pedir,
    responder,
    liberar,
  }
}
