import { act, renderHook } from '@testing-library/react'
import { Room, RoomEvent } from 'livekit-client'
import { beforeEach, describe, expect, it } from 'vitest'
import { useVez } from './useVez'

type Ouvinte = (metadata: string) => void

function salaFalsa() {
  const ouvintes = new Set<Ouvinte>()
  const sala = {
    metadata: undefined as string | undefined,
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
      for (const cb of ouvintes) cb(metadata)
    },
  }
  return sala
}

const EU = '11111111-1111-1111-1111-111111111111'

describe('useVez — derivação da metadata', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('cheri-share:identidade', EU)
  })

  it('começa vazio e sem dono', () => {
    const sala = salaFalsa()
    const { result } = renderHook(() => useVez(sala as unknown as Room, 's1'))
    expect(result.current.estado).toEqual({ sharer: null, pending: null })
    expect(result.current.souDono).toBe(false)
    expect(result.current.pedemMinhaVez).toBeNull()
  })

  it('reconhece que sou o dono e vejo quem pede a vez', () => {
    const sala = salaFalsa()
    const { result } = renderHook(() => useVez(sala as unknown as Room, 's1'))
    const pending = { identity: 'outro', nome: 'Bruno', expiraEm: 999 }
    act(() => {
      sala.emitir(
        JSON.stringify({
          sharer: { identity: EU, nome: 'Ana', desde: 10 },
          pending,
        }),
      )
    })
    expect(result.current.estado.sharer?.identity).toBe(EU)
    expect(result.current.souDono).toBe(true)
    expect(result.current.pedemMinhaVez).toEqual(pending)
  })

  it('quando o dono é outro, não sou dono e não recebo o pedido', () => {
    const sala = salaFalsa()
    const { result } = renderHook(() => useVez(sala as unknown as Room, 's1'))
    act(() => {
      sala.emitir(
        JSON.stringify({
          sharer: { identity: 'alguem', nome: 'Ana', desde: 10 },
          pending: { identity: EU, nome: 'Eu', expiraEm: 5 },
        }),
      )
    })
    expect(result.current.souDono).toBe(false)
    expect(result.current.pedemMinhaVez).toBeNull()
  })

  it('metadata malformada volta ao estado vazio', () => {
    const sala = salaFalsa()
    const { result } = renderHook(() => useVez(sala as unknown as Room, 's1'))
    act(() => {
      sala.emitir(JSON.stringify({ sharer: { identity: EU, nome: 'Ana', desde: 1 } }))
    })
    expect(result.current.souDono).toBe(true)
    act(() => {
      sala.emitir('isto não é json {')
    })
    expect(result.current.estado).toEqual({ sharer: null, pending: null })
    expect(result.current.souDono).toBe(false)
  })
})
