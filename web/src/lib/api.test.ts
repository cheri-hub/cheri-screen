import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarSala, pedirToken, pedirVez } from './api'

function respostaOk(corpo: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => corpo,
  } as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('post via criarSala', () => {
  it('faz POST em /api/rooms com o nome escolhido no body', async () => {
    fetchMock.mockResolvedValue(respostaOk({ id: 'festa-de-sexta' }))

    const id = await criarSala('Festa de Sexta')

    expect(id).toBe('festa-de-sexta')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/rooms')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'content-type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ nome: 'Festa de Sexta' })
  })
})

describe('post com corpo', () => {
  it('pedirToken envia content-type application/json e body JSON', async () => {
    fetchMock.mockResolvedValue(respostaOk({ token: 't', wsUrl: 'wss://x' }))

    await pedirToken('sala-1', 'id-1', 'Ana')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/rooms/sala-1/token')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'content-type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ identity: 'id-1', apelido: 'Ana' })
  })

  it('pedirVez envia content-type application/json e body JSON', async () => {
    fetchMock.mockResolvedValue(respostaOk({ decisao: { resultado: 'ocupado' } }))

    await pedirVez('sala-1', 'id-1', 'Ana')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/rooms/sala-1/floor/request')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'content-type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ identity: 'id-1', nome: 'Ana' })
  })
})

describe('erro HTTP', () => {
  it('lança com status quando a resposta não é ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 } as Response)

    await expect(criarSala('festa')).rejects.toMatchObject({ status: 400 })
  })
})
