import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PedidoDeVez } from './PedidoDeVez'

describe('PedidoDeVez', () => {
  it('mostra quem pede e o texto de aviso', () => {
    render(<PedidoDeVez nome="Pedro" aoResponder={vi.fn()} />)
    expect(screen.queryByText('Pedro')).not.toBeNull()
    expect(screen.queryByText(/quer compartilhar a tela\./)).not.toBeNull()
    expect(
      screen.queryByText(/Se você não responder em 30 segundos/),
    ).not.toBeNull()
  })

  it('"Ceder" chama aoResponder(true)', () => {
    const aoResponder = vi.fn()
    render(<PedidoDeVez nome="Pedro" aoResponder={aoResponder} />)
    fireEvent.click(screen.getByText('Ceder'))
    expect(aoResponder).toHaveBeenCalledWith(true)
  })

  it('"Recusar" chama aoResponder(false)', () => {
    const aoResponder = vi.fn()
    render(<PedidoDeVez nome="Pedro" aoResponder={aoResponder} />)
    fireEvent.click(screen.getByText('Recusar'))
    expect(aoResponder).toHaveBeenCalledWith(false)
  })
})
