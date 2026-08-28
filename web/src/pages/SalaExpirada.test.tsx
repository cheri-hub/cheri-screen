import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SalaExpirada } from './SalaExpirada'

describe('SalaExpirada', () => {
  it('mostra o título e um link para a home', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <SalaExpirada />
      </MemoryRouter>,
    )
    expect(getByRole('heading').textContent).toBe('Essa sala não existe mais')
    const link = getByRole('link', { name: 'Criar uma nova' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/')
  })
})
