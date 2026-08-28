import { useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client'

function ehTela(fonte: Track.Source) {
  return (
    fonte === Track.Source.ScreenShare ||
    fonte === Track.Source.ScreenShareAudio
  )
}

export function Player({ room }: { room: Room }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [temVideo, setTemVideo] = useState(false)

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

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <video
        ref={ref}
        autoPlay
        playsInline
        className="h-full w-full object-contain"
      />
      {!temVideo && (
        <p className="absolute inset-0 grid place-items-center text-neutral-500">
          Ninguém está compartilhando agora
        </p>
      )}
    </div>
  )
}
