import { act, render, screen } from '@testing-library/react'
import { Room, RoomEvent } from 'livekit-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SalaConectada } from './Sala'

const EU = '11111111-1111-1111-1111-111111111111'

type Ouvinte = () => void

function salaFalsa() {
  const ouvintes = new Set<Ouvinte>()
  const sala = {
    metadata: undefined as string | undefined,
    remoteParticipants: new Map(),
    localParticipant: {
      isScreenShareEnabled: false,
      setScreenShareEnabled: vi.fn(),
    },
    on(evento: string, cb: Ouvinte) {
      if (evento === RoomEvent.RoomMetadataChanged) ouvintes.add(cb)
      return sala
    },
    off(evento: string, cb: Ouvinte) {
      if (evento === RoomEvent.RoomMetadataChanged) ouvintes.delete(cb)
      return sala
    },
    emitir(metadata: string) {
      sala.metadata = metadata
      for (const cb of ouvintes) cb()
    },
  }
  return sala
}

function montar(sala: ReturnType<typeof salaFalsa>) {
  return render(
    <SalaConectada
      room={sala as unknown as Room}
      salaId="s1"
      apelido="Pedro"
      participantes={['Pedro']}
    />,
  )
}

describe('SalaConectada — ramos do takeover pela metadata', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('cheri-share:identidade', EU)
  })

  it('meu pedido ativo com dono presente mostra AguardandoResposta', () => {
    const sala = salaFalsa()
    montar(sala)
    act(() => {
      sala.emitir(
        JSON.stringify({
          sharer: { identity: 'ana', nome: 'Ana', desde: 1 },
          pending: { identity: EU, nome: 'Pedro', expiraEm: Date.now() + 30000 },
        }),
      )
    })
    expect(screen.queryByText(/Aguardando/)).not.toBeNull()
  })

  it('sou o dono e pedem minha vez: aparece o modal PedidoDeVez', () => {
    const sala = salaFalsa()
    montar(sala)
    act(() => {
      sala.emitir(
        JSON.stringify({
          sharer: { identity: EU, nome: 'Pedro', desde: 1 },
          pending: { identity: 'ana', nome: 'Ana', expiraEm: Date.now() + 30000 },
        }),
      )
    })
    expect(screen.queryByText(/quer compartilhar a tela\./)).not.toBeNull()
  })

  it('pedido de terceiro mostra o aviso discreto', () => {
    const sala = salaFalsa()
    montar(sala)
    act(() => {
      sala.emitir(
        JSON.stringify({
          sharer: { identity: 'ana', nome: 'Ana', desde: 1 },
          pending: { identity: 'joao', nome: 'João', expiraEm: Date.now() + 30000 },
        }),
      )
    })
    expect(
      screen.queryByText('João pediu a vez de compartilhar.'),
    ).not.toBeNull()
  })
})
