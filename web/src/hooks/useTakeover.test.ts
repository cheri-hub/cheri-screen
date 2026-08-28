import { act, renderHook, waitFor } from '@testing-library/react'
import { Room, RoomEvent } from 'livekit-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTakeover } from './useTakeover'
import { PERFIS } from '../lib/perfis'

const api = vi.hoisted(() => ({
  pedirVez: vi.fn(),
  responderVez: vi.fn(),
  liberarVez: vi.fn(),
}))

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  ...api,
}))

// `escolherCodec` sonda APIs de WebRTC ausentes no jsdom; `opcoesDeCaptura`
// e `PERFIS` continuam reais para a asserção da opção lembrada valer.
vi.mock('../lib/perfis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/perfis')>()),
  escolherCodec: vi.fn(() => 'vp9'),
}))

const EU = '11111111-1111-1111-1111-111111111111'

type Ouvinte = () => void

function salaFalsa() {
  const ouvintes = new Map<string, Set<Ouvinte>>()
  const sala = {
    metadata: undefined as string | undefined,
    localParticipant: {
      isScreenShareEnabled: false,
      setScreenShareEnabled: vi.fn<
        (ligar: boolean, captura?: unknown, publicacao?: unknown) => Promise<void>
      >(async () => {}),
    },
    on(evento: string, cb: Ouvinte) {
      const set = ouvintes.get(evento) ?? new Set<Ouvinte>()
      set.add(cb)
      ouvintes.set(evento, set)
      return sala
    },
    off(evento: string, cb: Ouvinte) {
      ouvintes.get(evento)?.delete(cb)
      return sala
    },
    emitir(metadata: string) {
      sala.metadata = metadata
      for (const cb of ouvintes.get(RoomEvent.RoomMetadataChanged) ?? []) cb()
    },
  }
  return sala
}

function montar(sala: ReturnType<typeof salaFalsa>) {
  return renderHook(() => useTakeover(sala as unknown as Room, 's1', 'Pedro'))
}

function metadata(sharer: unknown, pending: unknown): string {
  return JSON.stringify({ sharer, pending })
}

const ANA = { identity: 'ana', nome: 'Ana', desde: 1 }
const meuPedido = () => ({ identity: EU, nome: 'Pedro', expiraEm: Date.now() + 30000 })

describe('useTakeover — ramos da disputa da vez', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('cheri-share:identidade', EU)
    api.pedirVez.mockReset()
    api.responderVez.mockReset()
    api.liberarVez.mockReset()
    api.pedirVez.mockResolvedValue({ decisao: { resultado: 'aguardando', dono: 'ana' } })
  })

  it('branch 4: segundo solicitante recebe "ocupado" e vê o aviso de fila', async () => {
    api.pedirVez.mockResolvedValue({ decisao: { resultado: 'ocupado' } })
    const sala = salaFalsa()
    const { result } = montar(sala)

    await act(async () => {
      result.current.aoCompartilhar(PERFIS.tela, false, false)
    })

    expect(api.pedirVez).toHaveBeenCalledWith('s1', EU, 'Pedro')
    await waitFor(() =>
      expect(result.current.aviso).toBe('Já tem alguém na fila, tenta em instantes.'),
    )
  })

  it('branch 5: meu pedido some da metadata sem eu virar dono → aviso de recusa', () => {
    const sala = salaFalsa()
    const { result } = montar(sala)

    act(() => {
      sala.emitir(metadata(ANA, meuPedido()))
    })
    expect(result.current.meuPedido).not.toBeNull()

    act(() => {
      sala.emitir(metadata(ANA, null))
    })
    expect(result.current.aviso).toBe('Ana preferiu continuar.')
  })

  it('branch 6: perco a vez enquanto publico → paro de transmitir', () => {
    api.pedirVez.mockResolvedValue({
      decisao: { resultado: 'concedido', para: EU, revogarDe: null },
    })
    const sala = salaFalsa()
    montar(sala)

    act(() => {
      sala.emitir(metadata({ identity: EU, nome: 'Pedro', desde: 1 }, null))
    })
    sala.localParticipant.isScreenShareEnabled = true
    expect(sala.localParticipant.setScreenShareEnabled).not.toHaveBeenCalled()

    act(() => {
      sala.emitir(metadata({ identity: 'ana', nome: 'Ana', desde: 2 }, null))
    })
    expect(sala.localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(false)
  })

  it('branch 7: a vez fica livre enquanto aguardo → reenvia na hora com a opção lembrada', async () => {
    api.pedirVez
      .mockResolvedValueOnce({ decisao: { resultado: 'aguardando', dono: 'ana' } })
      .mockResolvedValueOnce({
        decisao: { resultado: 'concedido', para: EU, revogarDe: 'ana' },
      })
    const sala = salaFalsa()
    const { result } = montar(sala)

    await act(async () => {
      result.current.aoCompartilhar(PERFIS.video, true, false)
    })
    await waitFor(() => expect(api.pedirVez).toHaveBeenCalledTimes(1))

    act(() => {
      sala.emitir(metadata(ANA, meuPedido()))
    })
    await act(async () => {
      sala.emitir(metadata(null, meuPedido()))
    })

    await waitFor(() => expect(api.pedirVez).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(sala.localParticipant.setScreenShareEnabled).toHaveBeenCalled(),
    )

    const chamada = sala.localParticipant.setScreenShareEnabled.mock.calls.at(-1)
    const captura = chamada?.[1] as {
      resolution?: { width?: number }
      contentHint?: string
    }
    expect(chamada?.[0]).toBe(true)
    expect(captura?.resolution?.width).toBe(1920) // alta: true
    expect(captura?.contentHint).toBe('motion') // PERFIS.video
  })
})
