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
    <div className="space-y-3 rounded-xl bg-neutral-900 p-4">
      <p className="text-sm font-medium text-neutral-300">O que você vai mostrar?</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {lista.map((perfil) => (
          <button
            key={perfil.id}
            type="button"
            aria-pressed={escolhido === perfil.id}
            onClick={() => setEscolhido(perfil.id)}
            className={`rounded-lg border p-3 text-left ${
              escolhido === perfil.id
                ? 'border-emerald-500 bg-neutral-800'
                : 'border-neutral-700'
            }`}
          >
            <span className="block text-sm font-medium">{perfil.rotulo}</span>
            <span className="block text-xs text-neutral-400">{perfil.descricao}</span>
          </button>
        ))}
      </div>
      <AvisoNavegador />
      <label className="flex items-start gap-2 text-xs text-neutral-400">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={alta}
          onChange={(e) => setAlta(e.target.checked)}
        />
        <span>
          Alta definição (1080p)
          <span className="block text-neutral-500">dobra o consumo de banda</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-xs text-neutral-400">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={preferirAv1 && av1Disponivel}
          disabled={!av1Disponivel}
          onChange={(e) => setPreferirAv1(e.target.checked)}
        />
        <span>
          Usar AV1
          <span className="block text-neutral-500">
            economiza banda, mas exige mais do seu computador
          </span>
        </span>
      </label>
      <button
        type="button"
        onClick={() =>
          aoCompartilhar(PERFIS[escolhido], alta, preferirAv1 && av1Disponivel)
        }
        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium"
      >
        Compartilhar minha tela
      </button>
    </div>
  )
}
