import { useEffect, useState } from 'react'

const GB = 1024 ** 3

const emGb = (b: number) => (b / GB).toFixed(1).replace('.', ',')

export function Medidor() {
  const [bytes, setBytes] = useState<number | null>(null)
  const [inicial, setInicial] = useState<number | null>(null)

  useEffect(() => {
    const buscar = () =>
      fetch('/api/usage')
        .then((r) => r.json() as Promise<{ bytes: number }>)
        .then((d) => {
          setBytes(d.bytes)
          setInicial((antes) => antes ?? d.bytes)
        })
        .catch(() => undefined)

    void buscar()
    const t = setInterval(buscar, 30_000)
    return () => clearInterval(t)
  }, [])

  if (bytes === null || inicial === null) return null

  return (
    <p className="border-t border-line pt-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-dim/70">
      essa sessão: {emGb(bytes - inicial)} GB · mês: {emGb(bytes)} GB
    </p>
  )
}
