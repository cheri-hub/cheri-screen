import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { criarSala } from '../lib/api'

export function Home() {
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const navegar = useNavigate()

  async function aoCriar() {
    setCriando(true)
    setErro(null)
    try {
      navegar(`/sala/${await criarSala()}`)
    } catch {
      setErro('Não foi possível criar a sala. Tente de novo em instantes.')
      setCriando(false)
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-100 p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-semibold">cheri share</h1>
        <p className="text-neutral-400">
          Crie uma sala e mande o link pra galera assistir sua tela.
        </p>
        <button
          onClick={aoCriar}
          disabled={criando}
          className="w-full rounded-lg bg-emerald-500 py-3 font-medium text-neutral-950 disabled:opacity-50"
        >
          {criando ? 'Criando…' : 'Criar sala'}
        </button>
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
      </div>
    </main>
  )
}
