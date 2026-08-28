import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Medidor } from './Medidor'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Medidor', () => {
  it('mostra consumo da sessão e do mês em GB com vírgula decimal', async () => {
    const GB = 1024 ** 3
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ bytes: 3 * GB }),
      }),
    )

    render(<Medidor />)

    await waitFor(() => {
      expect(
        screen.getByText('essa sessão: 0,0 GB · mês: 3,0 GB'),
      ).not.toBeNull()
    })
  })
})
