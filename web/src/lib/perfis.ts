import {
  supportsAV1,
  supportsVP9,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
  type VideoCodec,
} from 'livekit-client'

export type Perfil = {
  id: 'tela' | 'video'
  rotulo: string
  descricao: string
  fps: number
  bitrate: number
  hint: 'detail' | 'motion'
}

export const PERFIS: Record<Perfil['id'], Perfil> = {
  tela: {
    id: 'tela',
    rotulo: 'Tela',
    descricao: 'Código, navegar, mostrar algo. Mais nítido, menos fluido.',
    fps: 15,
    bitrate: 500_000,
    hint: 'detail',
  },
  video: {
    id: 'video',
    rotulo: 'Vídeo',
    descricao: 'Filme, jogo, qualquer coisa em movimento.',
    fps: 30,
    bitrate: 800_000,
    hint: 'motion',
  },
}

/** VP9 é o padrão; AV1 só quando o navegador suporta e o usuário pede. */
export function escolherCodec(preferirAv1: boolean): VideoCodec {
  if (preferirAv1 && supportsAV1()) return 'av1'
  if (supportsVP9()) return 'vp9'
  return 'h264'
}

export function opcoesDeCaptura(
  perfil: Perfil,
  alta: boolean,
  codec: VideoCodec,
): { captura: ScreenShareCaptureOptions; publicacao: TrackPublishOptions } {
  const fator = alta ? 2 : 1
  return {
    captura: {
      audio: true,
      contentHint: perfil.hint,
      resolution: {
        width: alta ? 1920 : 1280,
        height: alta ? 1080 : 720,
        frameRate: perfil.fps,
      },
    },
    publicacao: {
      videoCodec: codec,
      simulcast: false,
      videoEncoding: {
        maxBitrate: perfil.bitrate * fator,
        maxFramerate: perfil.fps,
      },
      degradationPreference:
        perfil.hint === 'detail' ? 'maintain-resolution' : 'maintain-framerate',
    },
  }
}
