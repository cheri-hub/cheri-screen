import { useState } from 'react'

interface ModalApelidoProps {
  aoConfirmar: (apelido: string) => void
}

export function ModalApelido({ aoConfirmar }: ModalApelidoProps) {
  const [valor, setValor] = useState('')
  return (
    <div className="fixed inset-0 grid place-items-center bg-neutral-950/90 p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valor.trim()) aoConfirmar(valor.trim())
        }}
        className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-6"
      >
        <h2 className="text-lg font-medium text-neutral-100">Como te chamamos?</h2>
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          maxLength={24}
          placeholder="Seu apelido"
          className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-neutral-100"
        />
        <button className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950">
          Entrar
        </button>
      </form>
    </div>
  )
}
