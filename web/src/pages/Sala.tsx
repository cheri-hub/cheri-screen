import { useEffect, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { Room, RoomEvent } from 'livekit-client'
import { useSala } from '../hooks/useSala'
import { useTakeover } from '../hooks/useTakeover'
import { obterApelido, salvarApelido } from '../lib/identidade'
import { AguardandoResposta } from '../components/AguardandoResposta'
import { ModalApelido } from '../components/ModalApelido'
import { Medidor } from '../components/Medidor'
import { Participantes } from '../components/Participantes'
import { PedidoDeVez } from '../components/PedidoDeVez'
import { Player } from '../components/Player'
import { SeletorPerfil } from '../components/SeletorPerfil'
import { SalaExpirada } from './SalaExpirada'

const DURACAO_PEDIDO = 30_000

function fracaoDecorrida(expiraEm: number | undefined): number {
  if (!expiraEm) return 0
  const restante = Math.max(0, expiraEm - Date.now())
  return 1 - restante / DURACAO_PEDIDO
}

/** Fração 0→1 do tempo já decorrido do pedido de vez (para o arco da moldura). */
function useProgressoPedido(expiraEm: number | undefined): number {
  const [decorrido, setDecorrido] = useState(() => fracaoDecorrida(expiraEm))
  useEffect(() => {
    if (!expiraEm) return
    const t = setInterval(() => setDecorrido(fracaoDecorrida(expiraEm)), 250)
    return () => clearInterval(t)
  }, [expiraEm])
  return expiraEm ? decorrido : 0
}

function codigoSala(id: string): string {
  return id.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || '····'
}

export function Sala() {
  const { id = '' } = useParams()
  const [apelido, setApelido] = useState(obterApelido)
  const { room, estado, participantes, reconectando } = useSala(id, apelido)

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
    <main className="min-h-screen px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <span className="font-display text-sm font-bold uppercase tracking-[0.12em]">
            <span className="text-p1">Cheri</span>{' '}
            <span className="text-p2">Screen</span>
          </span>
          <span className="hud-label">
            room ▸ <span className="text-ink">{codigoSala(id)}</span>
          </span>
        </header>

        {reconectando && (
          <p className="chanfro mb-4 border border-wait/40 bg-wait/10 px-3 py-2 font-mono text-xs text-wait">
            Reconectando…
          </p>
        )}
        {estado === 'conectando' && (
          <p className="hud-label animate-pulse">Conectando…</p>
        )}
        {estado === 'erro' && (
          <p className="chanfro border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-sm text-danger">
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
      </div>
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

  const progresso = useProgressoPedido(estado.pending?.expiraEm)

  useEffect(() => {
    // Só o caminho "parou pela barra nativa do Chrome" (spec §6.4): o botão
    // libera a vez explicitamente. `.catch` engole o 403 do disparo em dobro
    // (vídeo + áudio de tela geram dois LocalTrackUnpublished).
    const aoDespublicar = () => void liberar().catch(() => undefined)
    room.on(RoomEvent.LocalTrackUnpublished, aoDespublicar)
    return () => {
      room.off(RoomEvent.LocalTrackUnpublished, aoDespublicar)
    }
  }, [room, liberar])

  async function pararDeCompartilhar() {
    // Libera a vez antes de despublicar: funciona mesmo quando a vez é detida
    // sem track publicada e evita depender do evento de track.
    await liberar().catch(() => undefined)
    await room.localParticipant.setScreenShareEnabled(false)
  }

  const turno = !estado.sharer
    ? 'livre'
    : souDono
      ? 'voce-live'
      : 'outro-live'

  return (
    <div className="space-y-4">
      {pedemMinhaVez && (
        <PedidoDeVez
          nome={pedemMinhaVez.nome}
          aoResponder={(aceita) => void responder(aceita)}
        />
      )}

      <div
        className="tela-bezel"
        data-turno={turno}
        data-disputa={estado.pending ? 'sim' : 'nao'}
        style={{ '--progresso': progresso } as CSSProperties}
      >
        <Player room={room} />
      </div>

      {/* HUD da vez — quem está no comando, num relance */}
      <div className="chanfro anima-hud flex items-center gap-3 border border-line bg-panel px-4 py-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            estado.sharer ? 'ponto-live bg-live' : 'bg-ink-dim/40'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="hud-label">{estado.sharer ? 'no ar' : 'sofá livre'}</p>
          <p className="truncate font-display text-lg font-bold uppercase leading-tight">
            {!estado.sharer
              ? 'A vez tá livre'
              : souDono
                ? 'Você no comando'
                : `${estado.sharer.nome} no comando`}
          </p>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="btn-fantasma shrink-0 px-3 py-2 text-xs"
        >
          Copiar link da sala
        </button>
      </div>

      {meuPedido && estado.sharer && (
        <AguardandoResposta
          dono={estado.sharer.nome}
          expiraEm={meuPedido.expiraEm}
          aoExpirar={aoExpirar}
        />
      )}
      {estado.pending && !meuPedido && !souDono && (
        <p className="font-mono text-xs text-ink-dim">
          {estado.pending.nome} pediu a vez de compartilhar.
        </p>
      )}
      {aviso && (
        <p className="chanfro border border-wait/40 bg-wait/10 px-3 py-2 font-mono text-xs text-wait">
          {aviso}
        </p>
      )}

      {souDono ? (
        <button
          onClick={pararDeCompartilhar}
          className="btn-fantasma px-4 py-2.5 text-sm"
        >
          Parar de compartilhar
        </button>
      ) : (
        <SeletorPerfil aoCompartilhar={aoCompartilhar} />
      )}

      <Participantes nomes={participantes} />

      <footer className="pt-2">
        <Medidor />
      </footer>
    </div>
  )
}
