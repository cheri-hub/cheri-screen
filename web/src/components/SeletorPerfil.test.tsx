import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeletorPerfil } from './SeletorPerfil'

vi.mock('livekit-client', () => ({
  supportsAV1: () => false,
  supportsVP9: () => true,
}))

describe('SeletorPerfil', () => {
  it('desabilita a opção "Usar AV1" quando o navegador não suporta AV1', () => {
    render(<SeletorPerfil aoCompartilhar={vi.fn()} />)
    const av1 = screen
      .getByText('Usar AV1')
      .closest('label')!
      .querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(av1.disabled).toBe(true)
  })

  it('mostra a nota de banda da alta definição', () => {
    render(<SeletorPerfil aoCompartilhar={vi.fn()} />)
    expect(screen.getByText('dobra o consumo de banda')).not.toBeNull()
  })
})
