import { renderHook, waitFor, act } from '@testing-library/react'
import { RoomEvent } from 'livekit-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSala } from './useSala'

const api = vi.hoisted(() => ({ pedirToken: vi.fn() }))
const h = vi.hoisted(() => ({
  connect: vi.fn(),
  instances: [] as { emit: (e: string) => void }[],
}))

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  ...api,
}))

vi.mock('livekit-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('livekit-client')>()
  class FakeRoom {
    private ouvintes = new Map<string, ((...a: unknown[]) => void)[]>()
    localParticipant = { name: 'você' }
    remoteParticipants = new Map()
    constructor() {
      h.instances.push(this)
    }
    on(evento: string, cb: (...a: unknown[]) => void) {
      this.ouvintes.set(evento, [...(this.ouvintes.get(evento) ?? []), cb])
      return this
    }
    off() {
      return this
    }
    connect(...a: unknown[]) {
      return h.connect(...a)
    }
    disconnect() {}
    emit(evento: string) {
      for (const cb of this.ouvintes.get(evento) ?? []) cb()
    }
  }
  return { ...actual, Room: FakeRoom }
})

describe('useSala — desfechos da conexão', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('cheri-share:identidade', 'id-1')
    api.pedirToken.mockReset()
    h.connect.mockReset()
    h.instances.length = 0
  })

  it('sucesso → conectado com room', async () => {
    api.pedirToken.mockResolvedValue({ token: 't', wsUrl: 'wss://x' })
    h.connect.mockResolvedValue(undefined)

    const { result } = renderHook(() => useSala('s1', 'Ana'))

    await waitFor(() => expect(result.current.estado).toBe('conectado'))
    expect(result.current.room).not.toBeNull()
  })

  it('token 404 → expirada', async () => {
    api.pedirToken.mockRejectedValue(Object.assign(new Error('falha'), { status: 404 }))

    const { result } = renderHook(() => useSala('s1', 'Ana'))

    await waitFor(() => expect(result.current.estado).toBe('expirada'))
  })

  it('outra falha → erro', async () => {
    api.pedirToken.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useSala('s1', 'Ana'))

    await waitFor(() => expect(result.current.estado).toBe('erro'))
  })

  it('Disconnected após conectar → erro e sem faixa de reconexão', async () => {
    api.pedirToken.mockResolvedValue({ token: 't', wsUrl: 'wss://x' })
    h.connect.mockResolvedValue(undefined)

    const { result } = renderHook(() => useSala('s1', 'Ana'))
    await waitFor(() => expect(result.current.estado).toBe('conectado'))

    act(() => {
      h.instances[0].emit(RoomEvent.Reconnecting)
    })
    expect(result.current.reconectando).toBe(true)

    act(() => {
      h.instances[0].emit(RoomEvent.Disconnected)
    })
    expect(result.current.estado).toBe('erro')
    expect(result.current.reconectando).toBe(false)
  })
})
