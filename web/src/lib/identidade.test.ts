import { beforeEach, describe, expect, it } from 'vitest'
import { obterIdentidade } from './identidade'

describe('obterIdentidade', () => {
  beforeEach(() => localStorage.clear())

  it('gera um UUID na primeira chamada e o reaproveita depois', () => {
    const primeira = obterIdentidade()
    expect(primeira).toMatch(/^[0-9a-f-]{36}$/)
    expect(obterIdentidade()).toBe(primeira)
  })
})
