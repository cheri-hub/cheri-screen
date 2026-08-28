import { useState } from 'react'
import { PERFIS, type Perfil } from '../lib/perfis'

type Props = {
  aoCompartilhar: (perfil: Perfil, alta: boolean, preferirAv1: boolean) => void
}

export function SeletorPerfil({ aoCompartilhar }: Props) {
  const [escolhido, setEscolhido] = useState<Perfil['id']>('tela')
  const [alta, setAlta] = useState(false)
  const [preferirAv1, setPreferirAv1] = useState(false)
  const lista = Object.values(PERFIS)

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
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        <input
          type="checkbox"
          checked={alta}
          onChange={(e) => setAlta(e.target.checked)}
        />
        Melhor qualidade de imagem (usa mais internet)
      </label>
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        <input
          type="checkbox"
          checked={preferirAv1}
          onChange={(e) => setPreferirAv1(e.target.checked)}
        />
        Economizar internet quando o navegador permitir
      </label>
      <button
        type="button"
        onClick={() => aoCompartilhar(PERFIS[escolhido], alta, preferirAv1)}
        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium"
      >
        Compartilhar minha tela
      </button>
    </div>
  )
}
