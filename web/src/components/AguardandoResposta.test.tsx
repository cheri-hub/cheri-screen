import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AguardandoResposta } from './AguardandoResposta'

describe('AguardandoResposta — contagem regressiva', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('decrementa os segundos a cada tique', () => {
    const expiraEm = Date.now() + 3000
    render(
      <AguardandoResposta dono="Ana" expiraEm={expiraEm} aoExpirar={vi.fn()} />,
    )
    expect(screen.queryByText(/3s/)).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText(/2s/)).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText(/1s/)).not.toBeNull()
  })

  it('chama aoExpirar quando chega a zero', () => {
    const aoExpirar = vi.fn()
    const expiraEm = Date.now() + 3000
    render(
      <AguardandoResposta dono="Ana" expiraEm={expiraEm} aoExpirar={aoExpirar} />,
    )

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByText(/0s/)).not.toBeNull()
    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })
})
