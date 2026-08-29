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
      setErro('Não deu pra abrir a sala. Tenta de novo em instantes.')
      setCriando(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-p2/20 to-transparent"
        style={{ animation: 'varredura 9s linear infinite' }}
      />

      <div className="relative mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center">
        <p className="hud-label mb-5">tela ao vivo · uma por vez</p>

        <h1 className="font-display text-[clamp(3rem,14vw,7rem)] font-bold uppercase leading-[0.86] tracking-tight">
          <span className="block text-p1 [text-shadow:0_0_32px_#ff3daf66]">Cheri</span>
          <span className="block text-p2 [text-shadow:0_0_32px_#31e7f566]">Screen</span>
        </h1>

        <p className="mt-6 max-w-md text-ink-dim">
          Abre a sala, joga o link no grupo, mostra tua tela pra galera — jogo,
          filme, o que for. Um de cada vez, e quem quiser a vez, pede. Simples
          assim, cheri.
        </p>

        <div className="mt-9">
          <button
            onClick={aoCriar}
            disabled={criando}
            className="btn-cheri px-8 py-4 text-base"
          >
            {criando ? 'Abrindo…' : 'Criar sala'}
          </button>
        </div>

        {erro && (
          <p className="mt-4 font-mono text-sm text-danger">{erro}</p>
        )}

        <p className="hud-label mt-12 !tracking-[0.14em]">
          sem conta · link é a chave · some sozinha quando esvazia
        </p>
      </div>
    </main>
  )
}
