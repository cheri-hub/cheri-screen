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

const lk = vi.hoisted(() => ({
  createLocalScreenTracks: vi.fn(),
}))

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  ...api,
}))

// `createLocalScreenTracks` roda `getDisplayMedia`, ausente no jsdom;
// `escolherCodec` sonda APIs de WebRTC também ausentes. `opcoesDeCaptura` e
// `PERFIS` seguem reais para a asserção da opção lembrada valer.
vi.mock('livekit-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('livekit-client')>()),
  createLocalScreenTracks: lk.createLocalScreenTracks,
}))

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
      setScreenShareEnabled: vi.fn(async () => {}),
      publishTrack: vi.fn(async () => {}),
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
    lk.createLocalScreenTracks.mockReset()
    lk.createLocalScreenTracks.mockImplementation(async () => [{ stop: vi.fn() }])
    api.pedirVez.mockResolvedValue({ decisao: { resultado: 'aguardando', dono: 'ana' } })
  })

  it('branch 4: segundo solicitante recebe "ocupado" e vê o aviso de fila', async () => {
    api.pedirVez.mockResolvedValue({ decisao: { resultado: 'ocupado' } })
    const sala = salaFalsa()
    const { result } = montar(sala)

    await act(async () => {
      await result.current.aoCompartilhar(PERFIS.tela, false, false)
    })

    expect(lk.createLocalScreenTracks).toHaveBeenCalled()
    expect(api.pedirVez).toHaveBeenCalledWith('s1', EU, 'Pedro')
    await waitFor(() =>
      expect(result.current.aviso).toBe('Já tem alguém na fila, tenta em instantes.'),
    )
    expect(sala.localParticipant.publishTrack).not.toHaveBeenCalled()
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

  it('C1: a metadata me torna dono sem resposta "concedido" minha → publica as tracks retidas', async () => {
    const sala = salaFalsa()
    const { result } = montar(sala)

    await act(async () => {
      await result.current.aoCompartilhar(PERFIS.tela, false, false)
    })
    await waitFor(() => expect(api.pedirVez).toHaveBeenCalledTimes(1))
    expect(sala.localParticipant.publishTrack).not.toHaveBeenCalled()

    // Ana cede: só a metadata muda no navegador do Pedro.
    await act(async () => {
      sala.emitir(metadata({ identity: EU, nome: 'Pedro', desde: 2 }, null))
    })

    await waitFor(() => expect(sala.localParticipant.publishTrack).toHaveBeenCalled())
  })

  it('C2: passados os 30s, aoExpirar concede a vez e publica sem recapturar', async () => {
    api.pedirVez
      .mockResolvedValueOnce({ decisao: { resultado: 'aguardando', dono: 'ana' } })
      .mockResolvedValueOnce({
        decisao: { resultado: 'concedido', para: EU, revogarDe: 'ana' },
      })
    const sala = salaFalsa()
    const { result } = montar(sala)

    await act(async () => {
      await result.current.aoCompartilhar(PERFIS.tela, false, false)
    })
    await waitFor(() => expect(api.pedirVez).toHaveBeenCalledTimes(1))

    await act(async () => {
      result.current.aoExpirar()
    })

    await waitFor(() => expect(sala.localParticipant.publishTrack).toHaveBeenCalled())
    expect(lk.createLocalScreenTracks).toHaveBeenCalledTimes(1)
    expect(result.current.aviso).not.toBe('Você não autorizou o compartilhamento')
  })

  it('C2b: sem captura de tela autorizada → avisa e não pede a vez', async () => {
    lk.createLocalScreenTracks.mockRejectedValue(new Error('negado'))
    const sala = salaFalsa()
    const { result } = montar(sala)

    await act(async () => {
      await result.current.aoCompartilhar(PERFIS.tela, false, false)
    })

    expect(result.current.aviso).toBe('Você não autorizou o compartilhamento')
    expect(api.pedirVez).not.toHaveBeenCalled()
  })

  it('branch 7 / (c): a vez fica livre enquanto aguardo → reenvia e publica a opção lembrada', async () => {
    api.pedirVez
      .mockResolvedValueOnce({ decisao: { resultado: 'aguardando', dono: 'ana' } })
      .mockResolvedValueOnce({
        decisao: { resultado: 'concedido', para: EU, revogarDe: 'ana' },
      })
    const sala = salaFalsa()
    const { result } = montar(sala)

    await act(async () => {
      await result.current.aoCompartilhar(PERFIS.video, true, false)
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
      expect(sala.localParticipant.publishTrack).toHaveBeenCalled(),
    )

    const captura = lk.createLocalScreenTracks.mock.calls[0]?.[0] as {
      resolution?: { width?: number }
      contentHint?: string
    }
    expect(captura?.resolution?.width).toBe(1920) // alta: true
    expect(captura?.contentHint).toBe('motion') // PERFIS.video
  })
})
