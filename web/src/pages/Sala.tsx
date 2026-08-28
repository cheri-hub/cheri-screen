import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSala } from '../hooks/useSala'
import { obterApelido, salvarApelido } from '../lib/identidade'
import { ModalApelido } from '../components/ModalApelido'
import { Participantes } from '../components/Participantes'
import { SalaExpirada } from './SalaExpirada'

export function Sala() {
  const { id = '' } = useParams()
  const [apelido, setApelido] = useState(obterApelido)
  const { estado, participantes } = useSala(id, apelido)

  if (!apelido) {
    return (
      <ModalApelido
        aoConfirmar={(a) => {
          salvarApelido(a)
          setApelido(a)
        }}
      />
    )
  }

  if (estado === 'expirada') return <SalaExpirada />

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      {estado === 'conectando' && <p className="text-neutral-400">Conectando…</p>}
      {estado === 'erro' && (
        <p className="text-red-400">
          Serviço indisponível. Tenta de novo em instantes.
        </p>
      )}
      {estado === 'conectado' && (
        <div className="mx-auto max-w-5xl space-y-4">
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="rounded-lg bg-neutral-800 px-3 py-2 text-sm"
          >
            Copiar link da sala
          </button>
          <Participantes nomes={participantes} />
        </div>
      )}
    </main>
  )
}
