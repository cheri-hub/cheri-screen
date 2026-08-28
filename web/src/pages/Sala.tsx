import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Room, RoomEvent } from 'livekit-client'
import { useSala } from '../hooks/useSala'
import { useVez } from '../hooks/useVez'
import { obterApelido, salvarApelido } from '../lib/identidade'
import { escolherCodec, opcoesDeCaptura, type Perfil } from '../lib/perfis'
import { ModalApelido } from '../components/ModalApelido'
import { Participantes } from '../components/Participantes'
import { Player } from '../components/Player'
import { SeletorPerfil } from '../components/SeletorPerfil'
import { SalaExpirada } from './SalaExpirada'

export function Sala() {
  const { id = '' } = useParams()
  const [apelido, setApelido] = useState(obterApelido)
  const { room, estado, participantes } = useSala(id, apelido)

  if (!apelido) {
    return (
      <ModalApelido
        aoConfirmar={(a) => {
          salvarApelido(a)
          setApelido(a)
        }}
      />
    )
  }

  if (estado === 'expirada') return <SalaExpirada />

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      {estado === 'conectando' && <p className="text-neutral-400">Conectando…</p>}
      {estado === 'erro' && (
        <p className="text-red-400">
          Serviço indisponível. Tenta de novo em instantes.
        </p>
      )}
      {estado === 'conectado' && room && (
        <SalaConectada
          room={room}
          salaId={id}
          apelido={apelido}
          participantes={participantes}
        />
      )}
    </main>
  )
}

type SalaConectadaProps = {
  room: Room
  salaId: string
  apelido: string
  participantes: string[]
}

function SalaConectada({
  room,
  salaId,
  apelido,
  participantes,
}: SalaConectadaProps) {
  const { souDono, pedir, liberar } = useVez(room, salaId)

  useEffect(() => {
    const aoDespublicar = () => void liberar()
    room.on(RoomEvent.LocalTrackUnpublished, aoDespublicar)
    return () => {
      room.off(RoomEvent.LocalTrackUnpublished, aoDespublicar)
    }
  }, [room, liberar])

  async function aoCompartilhar(
    perfil: Perfil,
    alta: boolean,
    preferirAv1: boolean,
  ) {
    const decisao = await pedir(apelido)
    if (decisao.resultado !== 'concedido') return decisao

    const codec = escolherCodec(preferirAv1)
    const { captura, publicacao } = opcoesDeCaptura(perfil, alta, codec)
    await room.localParticipant.setScreenShareEnabled(true, captura, publicacao)
    return decisao
  }

  async function pararDeCompartilhar() {
    await room.localParticipant.setScreenShareEnabled(false)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <button
        onClick={() => navigator.clipboard.writeText(window.location.href)}
        className="rounded-lg bg-neutral-800 px-3 py-2 text-sm"
      >
        Copiar link da sala
      </button>
      <Player room={room} />
      {souDono ? (
        <button
          onClick={pararDeCompartilhar}
          className="rounded-lg bg-neutral-800 px-3 py-2 text-sm"
        >
          Parar de compartilhar
        </button>
      ) : (
        <SeletorPerfil aoCompartilhar={aoCompartilhar} />
      )}
      <Participantes nomes={participantes} />
    </div>
  )
}
