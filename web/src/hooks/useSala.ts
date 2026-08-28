import { useEffect, useState } from 'react'
import { Room, RoomEvent, type RemoteParticipant } from 'livekit-client'
import { pedirToken } from '../lib/api'
import { obterIdentidade } from '../lib/identidade'

export type EstadoConexao = 'conectando' | 'conectado' | 'expirada' | 'erro'

export function useSala(salaId: string, apelido: string | null) {
  const [room, setRoom] = useState<Room | null>(null)
  const [estado, setEstado] = useState<EstadoConexao>('conectando')
  const [participantes, setParticipantes] = useState<string[]>([])
  const [reconectando, setReconectando] = useState(false)

  useEffect(() => {
    if (!apelido) return
    let cancelado = false
    const sala = new Room({
      adaptiveStream: true,
      dynacast: true,
    })

    function atualizarParticipantes() {
      const remotos = [...sala.remoteParticipants.values()] as RemoteParticipant[]
      setParticipantes([
        sala.localParticipant.name ?? 'você',
        ...remotos.map((p) => p.name ?? p.identity),
      ])
    }

    sala
      .on(RoomEvent.ParticipantConnected, atualizarParticipantes)
      .on(RoomEvent.ParticipantDisconnected, atualizarParticipantes)
      .on(RoomEvent.Connected, atualizarParticipantes)
      .on(RoomEvent.Reconnecting, () => setReconectando(true))
      .on(RoomEvent.Reconnected, () => setReconectando(false))

    ;(async () => {
      try {
        const { token, wsUrl } = await pedirToken(salaId, obterIdentidade(), apelido)
        await sala.connect(wsUrl, token)
        if (cancelado) return
        setRoom(sala)
        setEstado('conectado')
      } catch (e) {
        if (cancelado) return
        setEstado((e as { status?: number }).status === 404 ? 'expirada' : 'erro')
      }
    })()

    return () => {
      cancelado = true
      setReconectando(false)
      sala.disconnect()
    }
  }, [salaId, apelido])

  return { room, estado, participantes, reconectando }
}
