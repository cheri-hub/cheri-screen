import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvisoNavegador } from './AvisoNavegador'

afterEach(() => {
  vi.unstubAllGlobals()
})

const TRECHO =
  /Seu navegador não captura o áudio da tela — a galera vai ver a imagem sem som\. Chrome ou Edge resolvem\./

describe('AvisoNavegador', () => {
  it('avisa quando o navegador não captura o áudio da tela', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 Version/17.0 Safari/605.1.15',
    })
    render(<AvisoNavegador />)
    expect(screen.getByText(TRECHO)).not.toBeNull()
  })

  it('não renderiza nada em Chrome', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 Chrome/130.0 Safari/537.36',
    })
    const { container } = render(<AvisoNavegador />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(TRECHO)).toBeNull()
  })
})
