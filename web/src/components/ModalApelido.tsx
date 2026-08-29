import { useState } from 'react'

interface ModalApelidoProps {
  aoConfirmar: (apelido: string) => void
}

export function ModalApelido({ aoConfirmar }: ModalApelidoProps) {
  const [valor, setValor] = useState('')
  return (
    <div className="fixed inset-0 grid place-items-center bg-void/85 px-6 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valor.trim()) aoConfirmar(valor.trim())
        }}
        className="chanfro w-full max-w-sm border border-line bg-panel p-6"
      >
        <p className="hud-label mb-2 text-p1">player 1</p>
        <h2 className="font-display text-xl font-bold uppercase">
          Como te chamam?
        </h2>
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          maxLength={24}
          placeholder="Seu apelido"
          className="chanfro mt-4 w-full border border-line bg-panel-hi px-3 py-2 text-ink placeholder:text-ink-dim/60 focus:border-p1"
        />
        <button className="btn-cheri mt-4 w-full py-2.5 text-sm">Entrar</button>
        <p className="hud-label mt-3 !tracking-[0.12em]">
          só pra galera te reconhecer · dá pra ser qualquer coisa
        </p>
      </form>
    </div>
  )
}
