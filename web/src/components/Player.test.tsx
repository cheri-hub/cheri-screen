import { render } from '@testing-library/react'
import { Room, Track } from 'livekit-client'
import { describe, expect, it, vi } from 'vitest'
import { Player } from './Player'

function trackFalso(source: Track.Source) {
  return { source, attach: vi.fn(), detach: vi.fn() }
}

function salaFalsa(publicacoes: unknown[]) {
  const participante = { trackPublications: new Map(publicacoes.map((p, i) => [String(i), p])) }
  return {
    remoteParticipants: new Map(publicacoes.length ? [['p1', participante]] : []),
    on() {
      return this
    },
    off() {
      return this
    },
  }
}

describe('Player — entrar no meio da transmissão', () => {
  it('anexa uma tela já assinada ao montar', () => {
    const track = trackFalso(Track.Source.ScreenShare)
    const sala = salaFalsa([
      { isSubscribed: true, source: Track.Source.ScreenShare, track },
    ])
    const { queryByText } = render(<Player room={sala as unknown as Room} />)
    expect(track.attach).toHaveBeenCalledTimes(1)
    expect(queryByText('Ninguém está compartilhando agora')).toBeNull()
  })

  it('ignora publicações não assinadas e mostra o aviso', () => {
    const track = trackFalso(Track.Source.ScreenShare)
    const sala = salaFalsa([
      { isSubscribed: false, source: Track.Source.ScreenShare, track },
    ])
    const { queryByText } = render(<Player room={sala as unknown as Room} />)
    expect(track.attach).not.toHaveBeenCalled()
    expect(queryByText('Ninguém está compartilhando agora')).not.toBeNull()
  })

  it('sem transmissão em andamento mostra o aviso', () => {
    const sala = salaFalsa([])
    const { queryByText } = render(<Player room={sala as unknown as Room} />)
    expect(queryByText('Ninguém está compartilhando agora')).not.toBeNull()
  })
})
