import { useCallback, useEffect, useRef, useState } from 'react'
import {
  RoomEvent,
  createLocalScreenTracks,
  type LocalTrack,
  type Room,
  type TrackPublishOptions,
} from 'livekit-client'
import { lerEstadoDaVez, useVez } from './useVez'
import { obterIdentidade } from '../lib/identidade'
import { escolherCodec, opcoesDeCaptura, type Perfil } from '../lib/perfis'
import type { Decisao } from '../lib/api'

export type OpcaoCompartilhar = {
  perfil: Perfil
  alta: boolean
  preferirAv1: boolean
}

const AVISO_FILA = 'Já tem alguém na fila, tenta em instantes.'
const AVISO_FALHA = 'Não deu pra pedir a vez agora. Tenta de novo.'
const AVISO_PERMISSAO = 'Você não autorizou o compartilhamento'
const AVISO_LIVRE = 'A vez ficou livre, pedindo de novo…'

/**
 * Orquestra a disputa da vez sobre `useVez` com captura antecipada: ao clicar
 * em compartilhar, `getDisplayMedia` roda enquanto a ativação do usuário ainda
 * vale e as tracks ficam retidas; só então o pedido da vez é enviado. As tracks
 * são publicadas assim que `souDono` fica verdadeiro por qualquer caminho —
 * resposta própria, cessão via metadata ou reenvio após os 30s.
 */
export function useTakeover(room: Room, salaId: string, apelido: string) {
  const eu = obterIdentidade()
  const vez = useVez(room, salaId)
  const { estado, souDono, meuPedido, pedir, liberar } = vez

  const [aviso, setAviso] = useState<string | null>(null)
  const tracksRef = useRef<LocalTrack[] | null>(null)
  const publicacaoRef = useRef<TrackPublishOptions | null>(null)
  const publicandoRef = useRef(false)

  const descartarTracks = useCallback(() => {
    for (const t of tracksRef.current ?? []) t.stop()
    tracksRef.current = null
    publicacaoRef.current = null
  }, [])

  // Publica as tracks retidas. Idempotente: o lock evita publicar duas vezes
  // quando resposta própria e mudança de metadata chegam quase juntas.
  const publicarTracks = useCallback(async () => {
    const tracks = tracksRef.current
    if (!tracks || publicandoRef.current) return
    publicandoRef.current = true
    try {
      for (const track of tracks) {
        await room.localParticipant.publishTrack(
          track,
          publicacaoRef.current ?? undefined,
        )
      }
      tracksRef.current = null
    } catch {
      // Publicação recusada pelo SFU: devolve a vez pra fila não travar.
      descartarTracks()
      setAviso(AVISO_FALHA)
      await liberar().catch(() => undefined)
    } finally {
      publicandoRef.current = false
    }
  }, [room, descartarTracks, liberar])

  // Envia (ou reenvia) o pedido da vez. A captura já aconteceu no clique.
  const concluirPedido = useCallback(async () => {
    if (!tracksRef.current) return
    let decisao: Decisao
    try {
      decisao = await pedir(apelido)
    } catch {
      // token-service ou floor fora do ar: não trava, só avisa.
      descartarTracks()
      setAviso(AVISO_FALHA)
      return
    }
    if (decisao.resultado === 'aguardando') return
    if (decisao.resultado === 'concedido') {
      await publicarTracks()
    } else if (decisao.resultado === 'ocupado') {
      descartarTracks()
      setAviso(AVISO_FILA)
    } else if (decisao.resultado === 'ignorado') {
      descartarTracks()
      setAviso(AVISO_FALHA)
    }
    // 'recusado' | 'liberado': o listener da metadata cuida do aviso e do descarte.
  }, [pedir, apelido, publicarTracks, descartarTracks])

  const aoCompartilhar = useCallback(
    async (perfil: Perfil, alta: boolean, preferirAv1: boolean) => {
      setAviso(null)
      if (tracksRef.current || souDono) return
      const codec = escolherCodec(preferirAv1)
      const { captura, publicacao } = opcoesDeCaptura(perfil, alta, codec)
      try {
        // getDisplayMedia enquanto o clique ainda conta como ativação do usuário.
        tracksRef.current = await createLocalScreenTracks(captura)
      } catch {
        setAviso(AVISO_PERMISSAO)
        return
      }
      publicacaoRef.current = publicacao
      await concluirPedido()
    },
    [concluirPedido, souDono],
  )

  const aoExpirar = useCallback(() => {
    if (tracksRef.current) void concluirPedido()
  }, [concluirPedido])

  // Virei dono por qualquer caminho (resposta própria, cessão via metadata,
  // reenvio pós-30s): publica o que está retido.
  useEffect(() => {
    if (souDono && tracksRef.current) void publicarTracks()
  }, [souDono, publicarTracks])

  // A vez esvaziou enquanto eu aguardava: reenvia na hora, sem esperar os 30s.
  useEffect(() => {
    if (meuPedido && !estado.sharer && tracksRef.current) {
      void concluirPedido()
    }
  }, [meuPedido, estado.sharer, concluirPedido])

  // Meu pedido sumiu da metadata sem eu virar dono: reajo à transição
  // (evento externo), não a um efeito.
  useEffect(() => {
    let tinhaMeuPedido = lerEstadoDaVez(room.metadata).pending?.identity === eu
    const aoMudar = () => {
      const atual = lerEstadoDaVez(room.metadata)
      const souODono = atual.sharer?.identity === eu
      if (tinhaMeuPedido && !atual.pending && !souODono) {
        if (atual.sharer) {
          descartarTracks()
          setAviso(`${atual.sharer.nome} preferiu continuar.`)
        } else if (tracksRef.current) {
          setAviso(AVISO_LIVRE)
          void concluirPedido()
        } else {
          descartarTracks()
        }
      }
      tinhaMeuPedido = atual.pending?.identity === eu
    }
    room.on(RoomEvent.RoomMetadataChanged, aoMudar)
    return () => {
      room.off(RoomEvent.RoomMetadataChanged, aoMudar)
    }
  }, [room, eu, concluirPedido, descartarTracks])

  // Perdi a vez enquanto ainda publicava: paro de transmitir.
  useEffect(() => {
    if (!souDono && room.localParticipant.isScreenShareEnabled) {
      void room.localParticipant.setScreenShareEnabled(false)
    }
  }, [souDono, room])

  // Saí da tela sem publicar: não deixa a captura viva.
  useEffect(() => descartarTracks, [descartarTracks])

  return { ...vez, aviso, aoCompartilhar, aoExpirar }
}
