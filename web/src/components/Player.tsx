import { useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client'

export function Player({ room }: { room: Room }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [temVideo, setTemVideo] = useState(false)

  useEffect(() => {
    function aoAssinar(track: RemoteTrack) {
      if (
        track.source !== Track.Source.ScreenShare &&
        track.source !== Track.Source.ScreenShareAudio
      )
        return
      if (ref.current) track.attach(ref.current)
      setTemVideo(true)
    }
    function aoDesassinar(track: RemoteTrack) {
      track.detach()
      setTemVideo(false)
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
