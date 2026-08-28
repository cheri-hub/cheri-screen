import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Participantes } from './Participantes'

describe('Participantes', () => {
  it('renderiza um <li> por nome recebido', () => {
    const nomes = ['ana', 'bruno', 'você']
    const { container } = render(<Participantes nomes={nomes} />)
    const itens = Array.from(container.querySelectorAll('li'))
    expect(itens).toHaveLength(3)
    expect(itens.map((li) => li.textContent)).toEqual(nomes)
  })

  it('renderiza uma lista vazia sem nomes', () => {
    const { container } = render(<Participantes nomes={[]} />)
    expect(container.querySelectorAll('li')).toHaveLength(0)
  })
})
