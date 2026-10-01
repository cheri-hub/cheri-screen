import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Home } from './Home'

const criarSalaMock = vi.fn()
vi.mock('../lib/api', () => ({ criarSala: (...args: unknown[]) => criarSalaMock(...args) }))

const navegarMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...real, useNavigate: () => navegarMock }
})

function montar() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  )
}

describe('Home', () => {
  beforeEach(() => {
    criarSalaMock.mockReset()
    navegarMock.mockReset()
  })

  it('bloqueia a criação até o nome virar um slug válido', () => {
    montar()
    const botao = screen.getByRole('button', { name: /criar sala/i }) as HTMLButtonElement
    expect(botao.disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText(/nome da sala/i), {
      target: { value: 'ab' },
    })
    expect(botao.disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText(/nome da sala/i), {
      target: { value: 'Festa de Sexta' },
    })
    expect(botao.disabled).toBe(false)
  })

  it('mostra a prévia do slug que vai virar o link', () => {
    montar()
    fireEvent.change(screen.getByPlaceholderText(/nome da sala/i), {
      target: { value: 'São João!!' },
    })
    expect(screen.getByText(/sao-joao/)).not.toBeNull()
  })

  it('cria a sala com o nome digitado e navega pro slug devolvido', async () => {
    criarSalaMock.mockResolvedValue('festa-de-sexta')
    montar()
    fireEvent.change(screen.getByPlaceholderText(/nome da sala/i), {
      target: { value: 'Festa de Sexta' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /criar sala/i }))
    })

    expect(criarSalaMock).toHaveBeenCalledWith('Festa de Sexta')
    expect(navegarMock).toHaveBeenCalledWith('/sala/festa-de-sexta')
  })

  it('mostra erro quando a criação falha', async () => {
    criarSalaMock.mockRejectedValue(new Error('falha'))
    montar()
    fireEvent.change(screen.getByPlaceholderText(/nome da sala/i), {
      target: { value: 'Festa' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /criar sala/i }))
    })

    expect(screen.getByText(/Não deu pra abrir a sala/)).not.toBeNull()
  })
})
