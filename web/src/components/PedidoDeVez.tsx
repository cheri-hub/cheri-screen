interface PedidoDeVezProps {
  nome: string
  aoResponder: (aceita: boolean) => void
}

/** Modal mostrado a quem detém a vez quando alguém pede para assumir a tela. */
export function PedidoDeVez({ nome, aoResponder }: PedidoDeVezProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-void/85 px-6 backdrop-blur-sm">
      <div className="chanfro anima-hud w-full max-w-sm border border-wait bg-panel p-6 shadow-glow-wait">
        <p className="hud-label mb-3 text-wait">pediram a vez</p>
        <p className="text-ink">
          <span className="block font-display text-3xl font-bold uppercase leading-none text-p2">
            {nome}
          </span>
          <span className="mt-1 block">quer compartilhar a tela.</span>
        </p>
        <p className="mt-3 font-mono text-xs text-ink-dim">
          Se você não responder em 30 segundos, a vez passa automaticamente.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => aoResponder(true)}
            className="btn-cheri flex-1 py-2.5 text-sm"
          >
            Ceder
          </button>
          <button
            type="button"
            onClick={() => aoResponder(false)}
            className="btn-fantasma flex-1 py-2.5 text-sm"
          >
            Recusar
          </button>
        </div>
      </div>
    </div>
  )
}
