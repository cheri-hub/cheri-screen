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
    <div className="rounded-lg bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
      Aguardando <strong>{dono}</strong> responder… {restante}s
    </div>
  )
}
