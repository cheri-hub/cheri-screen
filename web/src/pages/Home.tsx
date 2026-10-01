import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { criarSala } from '../lib/api'
import { TAMANHO_MIN, slugify } from '../lib/slugify'

export function Home() {
  const [nome, setNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const navegar = useNavigate()

  const slug = slugify(nome)
  const nomeValido = slug.length >= TAMANHO_MIN

  async function aoCriar(e: FormEvent) {
    e.preventDefault()
    if (!nomeValido || criando) return
    setCriando(true)
    setErro(null)
    try {
      navegar(`/sala/${await criarSala(nome)}`)
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

        <form onSubmit={aoCriar} className="mt-9 max-w-md">
          <label htmlFor="nome-sala" className="hud-label mb-2 block text-p1">
            nome da sala
          </label>
          <input
            id="nome-sala"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={48}
            placeholder="Nome da sala"
            className="chanfro w-full border border-line bg-panel-hi px-3 py-2 text-ink placeholder:text-ink-dim/60 focus:border-p1"
          />
          <p className="mt-2 font-mono text-xs text-ink-dim">
            {slug ? (
              <>
                vai ficar: <span className="text-p2">/sala/{slug}</span>
              </>
            ) : (
              'pelo menos 3 letras ou números viram o link da sala'
            )}
          </p>

          <button
            type="submit"
            disabled={!nomeValido || criando}
            className="btn-cheri mt-4 px-8 py-4 text-base"
          >
            {criando ? 'Abrindo…' : 'Criar sala'}
          </button>
        </form>

        {erro && (
          <p className="mt-4 font-mono text-sm text-danger">{erro}</p>
        )}

        <p className="hud-label mt-12 !tracking-[0.14em]">
          sem conta · o nome da sala é o link · some sozinha quando esvazia
        </p>
      </div>
    </main>
  )
}
