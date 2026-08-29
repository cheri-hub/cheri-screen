import { useCallback, useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client'

function ehTela(fonte: Track.Source) {
  return (
    fonte === Track.Source.ScreenShare ||
    fonte === Track.Source.ScreenShareAudio
  )
}

type ElementoTelaCheia = HTMLElement & {
  webkitRequestFullscreen?: () => void
}
type DocTelaCheia = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void
}

export function Player({ room }: { room: Room }) {
  const ref = useRef<HTMLVideoElement>(null)
  const caixaRef = useRef<HTMLDivElement>(null)
  const [temVideo, setTemVideo] = useState(false)
  const [telaCheia, setTelaCheia] = useState(false)

  useEffect(() => {
    const el = ref.current

    function anexar(track: RemoteTrack) {
      if (el) track.attach(el)
      setTemVideo(true)
    }

    function aoAssinar(track: RemoteTrack) {
      if (ehTela(track.source)) anexar(track)
    }

    function aoDesassinar(track: RemoteTrack) {
      if (!ehTela(track.source)) return
      track.detach()
      setTemVideo(false)
    }

    // Entrei no meio de uma transmissão: anexa o que já está assinado
    // antes de registrar os ouvintes de eventos.
    for (const participante of room.remoteParticipants.values()) {
      for (const pub of participante.trackPublications.values()) {
        if (pub.isSubscribed && pub.track && ehTela(pub.source)) {
          anexar(pub.track)
        }
      }
    }

    room.on(RoomEvent.TrackSubscribed, aoAssinar)
    room.on(RoomEvent.TrackUnsubscribed, aoDesassinar)
    return () => {
      room.off(RoomEvent.TrackSubscribed, aoAssinar)
      room.off(RoomEvent.TrackUnsubscribed, aoDesassinar)
    }
  }, [room])

  // Mantém o rótulo do botão em sincronia com a saída via Esc ou gesto nativo.
  useEffect(() => {
    const doc = document as DocTelaCheia
    const sincronizar = () =>
      setTelaCheia(
        Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement),
      )
    document.addEventListener('fullscreenchange', sincronizar)
    document.addEventListener('webkitfullscreenchange', sincronizar)
    return () => {
      document.removeEventListener('fullscreenchange', sincronizar)
      document.removeEventListener('webkitfullscreenchange', sincronizar)
    }
  }, [])

  const alternarTelaCheia = useCallback(() => {
    const doc = document as DocTelaCheia
    const caixa = caixaRef.current as ElementoTelaCheia | null
    if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
      ;(doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc)
      return
    }
    ;(caixa?.requestFullscreen ?? caixa?.webkitRequestFullscreen)?.call(caixa)
  }, [])

  return (
    <div
      ref={caixaRef}
      className="chanfro group relative aspect-video w-full overflow-hidden bg-black"
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        className="h-full w-full object-contain"
      />
      {!temVideo && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="hud-label !tracking-[0.2em]">
            Ninguém está compartilhando agora
          </p>
        </div>
      )}
      {temVideo && (
        <button
          type="button"
          onClick={alternarTelaCheia}
          aria-label={telaCheia ? 'Sair da tela cheia' : 'Ver em tela cheia'}
          className="btn-fantasma absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 text-[0.6875rem] uppercase tracking-[0.14em] opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="square"
            aria-hidden="true"
          >
            {telaCheia ? (
              <path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" />
            ) : (
              <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
            )}
          </svg>
          {telaCheia ? 'Sair' : 'Tela cheia'}
        </button>
      )}
    </div>
  )
}
