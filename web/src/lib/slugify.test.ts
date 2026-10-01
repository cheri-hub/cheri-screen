import { describe, expect, it } from 'vitest'
import { TAMANHO_MIN, slugify } from './slugify'

describe('slugify', () => {
  it('normaliza minúsculas e espaços', () => {
    expect(slugify('Festa de Sexta')).toBe('festa-de-sexta')
  })

  it('remove acentos', () => {
    expect(slugify('São João')).toBe('sao-joao')
  })

  it('troca símbolos por hífen e colapsa repetições', () => {
    expect(slugify('Festa!!! ## 2026')).toBe('festa-2026')
  })

  it('corta hífens nas pontas', () => {
    expect(slugify('--festa--')).toBe('festa')
  })

  it('string vazia ou só símbolos vira slug vazio', () => {
    expect(slugify('   ')).toBe('')
    expect(slugify('###')).toBe('')
  })

  it('corta no tamanho máximo sem deixar hífen pendurado', () => {
    const longo = 'a'.repeat(50) + '-b'
    const slug = slugify(longo)
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('TAMANHO_MIN marca o limite de validade', () => {
    expect(slugify('ab').length).toBeLessThan(TAMANHO_MIN)
    expect(slugify('abc').length).toBeGreaterThanOrEqual(TAMANHO_MIN)
  })
})
