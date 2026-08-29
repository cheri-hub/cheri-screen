import { useState } from 'react'
import { PERFIS, type Perfil } from '../lib/perfis'
import { av1Suportado } from '../lib/navegador'
import { AvisoNavegador } from './AvisoNavegador'

type Props = {
  aoCompartilhar: (perfil: Perfil, alta: boolean, preferirAv1: boolean) => void
}

export function SeletorPerfil({ aoCompartilhar }: Props) {
  const [escolhido, setEscolhido] = useState<Perfil['id']>('tela')
  const [alta, setAlta] = useState(false)
  const [preferirAv1, setPreferirAv1] = useState(false)
  const lista = Object.values(PERFIS)
  const av1Disponivel = av1Suportado()

  return (
    <div className="chanfro border border-line bg-panel p-4">
      <p className="hud-label mb-3 text-p1">O que você vai mostrar?</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {lista.map((perfil) => {
          const ativo = escolhido === perfil.id
          return (
            <button
              key={perfil.id}
              type="button"
              aria-pressed={ativo}
              onClick={() => setEscolhido(perfil.id)}
              className={`chanfro border p-3 text-left transition-colors ${
                ativo
                  ? 'border-p1 bg-panel-hi shadow-glow-p1'
                  : 'border-line hover:border-p2'
              }`}
            >
              <span className="block font-display text-sm font-semibold uppercase tracking-wide">
                {perfil.rotulo}
              </span>
              <span className="mt-0.5 block text-xs text-ink-dim">
                {perfil.descricao}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3">
        <AvisoNavegador />
      </div>

      <label className="mt-3 flex items-start gap-2 font-mono text-xs text-ink-dim">
        <input
          type="checkbox"
          className="mt-0.5 accent-p1"
          checked={alta}
          onChange={(e) => setAlta(e.target.checked)}
        />
        <span>
          Alta definição (1080p)
          <span className="block text-ink-dim/60">dobra o consumo de banda</span>
        </span>
      </label>
      <label className="mt-2 flex items-start gap-2 font-mono text-xs text-ink-dim">
        <input
          type="checkbox"
          className="mt-0.5 accent-p1"
          checked={preferirAv1 && av1Disponivel}
          disabled={!av1Disponivel}
          onChange={(e) => setPreferirAv1(e.target.checked)}
        />
        <span>
          Usar AV1
          <span className="block text-ink-dim/60">
            economiza banda, mas exige mais do seu computador
          </span>
        </span>
      </label>

      <button
        type="button"
        onClick={() =>
          aoCompartilhar(PERFIS[escolhido], alta, preferirAv1 && av1Disponivel)
        }
        className="btn-cheri mt-4 w-full py-2.5 text-sm"
      >
        Compartilhar minha tela
      </button>
    </div>
  )
}
