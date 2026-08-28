import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Room, RoomEvent } from 'livekit-client'
import { useSala } from '../hooks/useSala'
import { useTakeover } from '../hooks/useTakeover'
import { obterApelido, salvarApelido } from '../lib/identidade'
import { AguardandoResposta } from '../components/AguardandoResposta'
import { ModalApelido } from '../components/ModalApelido'
import { Participantes } from '../components/Participantes'
import { PedidoDeVez } from '../components/PedidoDeVez'
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

export function SalaConectada({
  room,
  salaId,
  apelido,
  participantes,
}: SalaConectadaProps) {
  const {
    estado,
    souDono,
    pedemMinhaVez,
    meuPedido,
    responder,
    liberar,
    aviso,
    aoCompartilhar,
    aoExpirar,
  } = useTakeover(room, salaId, apelido)

  useEffect(() => {
    const aoDespublicar = () => void liberar()
    room.on(RoomEvent.LocalTrackUnpublished, aoDespublicar)
    return () => {
      room.off(RoomEvent.LocalTrackUnpublished, aoDespublicar)
    }
  }, [room, liberar])

  async function pararDeCompartilhar() {
    await room.localParticipant.setScreenShareEnabled(false)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {pedemMinhaVez && (
        <PedidoDeVez
          nome={pedemMinhaVez.nome}
          aoResponder={(aceita) => void responder(aceita)}
        />
      )}
      <button
        onClick={() => navigator.clipboard.writeText(window.location.href)}
        className="rounded-lg bg-neutral-800 px-3 py-2 text-sm"
      >
        Copiar link da sala
      </button>
      <Player room={room} />
      {meuPedido && estado.sharer && (
        <AguardandoResposta
          dono={estado.sharer.nome}
          expiraEm={meuPedido.expiraEm}
          aoExpirar={aoExpirar}
        />
      )}
      {estado.pending && !meuPedido && !souDono && (
        <p className="text-sm text-neutral-400">
          {estado.pending.nome} pediu a vez de compartilhar.
        </p>
      )}
      {aviso && <p className="text-sm text-amber-300">{aviso}</p>}
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
