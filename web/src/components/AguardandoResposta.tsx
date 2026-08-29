import { useEffect, useState } from 'react'

interface AguardandoRespostaProps {
  dono: string
  expiraEm: number
  aoExpirar: () => void
}

function segundosRestantes(expiraEm: number): number {
  return Math.max(0, Math.ceil((expiraEm - Date.now()) / 1000))
}

/**
 * Faixa mostrada a quem pediu a vez, com contagem regressiva derivada de
 * `expiraEm`. Ao chegar a zero chama `aoExpirar`, que reenvia o pedido — o
 * servidor concede porque o pedido venceu ("silêncio cede a vez").
 */
export function AguardandoResposta({
  dono,
  expiraEm,
  aoExpirar,
}: AguardandoRespostaProps) {
  const [restante, setRestante] = useState(() => segundosRestantes(expiraEm))

  useEffect(() => {
    const t = setInterval(() => {
      const s = segundosRestantes(expiraEm)
      setRestante(s)
      if (s === 0) {
        clearInterval(t)
        aoExpirar()
      }
    }, 1000)
    return () => clearInterval(t)
  }, [expiraEm, aoExpirar])

  return (
    <div className="chanfro anima-hud flex items-center gap-3 border border-wait/50 bg-wait/10 px-4 py-2.5">
      <span className="font-mono text-2xl font-bold leading-none text-wait">
        {restante}s
      </span>
      <span className="text-sm text-ink-dim">
        Aguardando <span className="text-ink">{dono}</span> responder…
      </span>
    </div>
  )
}
