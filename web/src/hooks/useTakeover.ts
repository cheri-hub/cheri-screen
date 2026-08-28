import { useCallback, useEffect, useRef, useState } from 'react'
import { RoomEvent, type Room } from 'livekit-client'
import { lerEstadoDaVez, useVez } from './useVez'
import { obterIdentidade } from '../lib/identidade'
import { escolherCodec, opcoesDeCaptura, type Perfil } from '../lib/perfis'

export type OpcaoCompartilhar = {
  perfil: Perfil
  alta: boolean
  preferirAv1: boolean
}

const AVISO_FILA = 'Já tem alguém na fila, tenta em instantes.'

/**
 * Orquestra a disputa da vez sobre `useVez`: pede a vez, começa a publicar
 * quando é concedida, guarda a escolha para reenviar ao vencer os 30s ou
 * quando a vez fica livre, e avisa o solicitante quando o pedido é recusado.
 */
export function useTakeover(room: Room, salaId: string, apelido: string) {
  const eu = obterIdentidade()
  const vez = useVez(room, salaId)
  const { estado, souDono, meuPedido, pedir } = vez

  const [aviso, setAviso] = useState<string | null>(null)
  const opcaoRef = useRef<OpcaoCompartilhar | null>(null)

  const publicar = useCallback(
    async ({ perfil, alta, preferirAv1 }: OpcaoCompartilhar) => {
      const codec = escolherCodec(preferirAv1)
      const { captura, publicacao } = opcoesDeCaptura(perfil, alta, codec)
      await room.localParticipant.setScreenShareEnabled(true, captura, publicacao)
    },
    [room],
  )

  const concluirPedido = useCallback(
    async (opcao: OpcaoCompartilhar) => {
      const decisao = await pedir(apelido)
      if (decisao.resultado === 'concedido') {
        opcaoRef.current = null
        await publicar(opcao)
      } else if (decisao.resultado === 'ocupado') {
        opcaoRef.current = null
        setAviso(AVISO_FILA)
      } else if (decisao.resultado === 'aguardando') {
        opcaoRef.current = opcao
      }
    },
    [pedir, apelido, publicar],
  )

  const aoCompartilhar = useCallback(
    (perfil: Perfil, alta: boolean, preferirAv1: boolean) => {
      setAviso(null)
      void concluirPedido({ perfil, alta, preferirAv1 })
    },
    [concluirPedido],
  )

  const aoExpirar = useCallback(() => {
    if (opcaoRef.current) void concluirPedido(opcaoRef.current)
  }, [concluirPedido])

  // A vez ficou livre enquanto eu aguardava: reenvia na hora, sem esperar os 30s.
  useEffect(() => {
    if (meuPedido && !estado.sharer && opcaoRef.current) {
      void concluirPedido(opcaoRef.current)
    }
  }, [meuPedido, estado.sharer, concluirPedido])

  // Quem tinha a vez recusou: reajo à transição da metadata (evento externo),
  // não a um efeito — o pedido some sem eu virar dono.
  useEffect(() => {
    let tinhaMeuPedido = lerEstadoDaVez(room.metadata).pending?.identity === eu
    const aoMudar = () => {
      const atual = lerEstadoDaVez(room.metadata)
      const souODono = atual.sharer?.identity === eu
      if (tinhaMeuPedido && !atual.pending && !souODono) {
        opcaoRef.current = null
        if (atual.sharer) setAviso(`${atual.sharer.nome} preferiu continuar.`)
      }
      tinhaMeuPedido = atual.pending?.identity === eu
    }
    room.on(RoomEvent.RoomMetadataChanged, aoMudar)
    return () => {
      room.off(RoomEvent.RoomMetadataChanged, aoMudar)
    }
  }, [room, eu])

  // Perdi a vez enquanto ainda publicava: paro de transmitir.
  useEffect(() => {
    if (!souDono && room.localParticipant.isScreenShareEnabled) {
      void room.localParticipant.setScreenShareEnabled(false)
    }
  }, [souDono, room])

  return { ...vez, aviso, aoCompartilhar, aoExpirar }
}
