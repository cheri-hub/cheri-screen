import { supportsAV1 } from 'livekit-client'

/** Só Chrome/Edge capturam áudio da tela; Firefox só de aba, Safari nenhum. */
export function capturaDeAudioSuportada(): boolean {
  const ua = navigator.userAgent
  const ehChromium = /Chrome\/|Edg\//.test(ua)
  return ehChromium && !/OPR\//.test(ua)
}

/**
 * `supportsAV1` da livekit-client toca em APIs de WebRTC que podem não existir
 * (jsdom, navegadores antigos); aqui a ausência vira "não suporta".
 */
export function av1Suportado(): boolean {
  try {
    return supportsAV1()
  } catch {
    return false
  }
}
