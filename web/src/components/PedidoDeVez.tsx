interface PedidoDeVezProps {
  nome: string
  aoResponder: (aceita: boolean) => void
}

/** Modal mostrado a quem detém a vez quando alguém pede para assumir a tela. */
export function PedidoDeVez({ nome, aoResponder }: PedidoDeVezProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/90 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-6">
        <p className="text-neutral-100">
          <strong>{nome}</strong> quer compartilhar a tela.
        </p>
        <p className="text-sm text-neutral-400">
          Se você não responder em 30 segundos, a vez passa automaticamente.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => aoResponder(true)}
            className="flex-1 rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950"
          >
            Ceder
          </button>
          <button
            type="button"
            onClick={() => aoResponder(false)}
            className="flex-1 rounded-lg bg-neutral-700 py-2 font-medium text-neutral-100"
          >
            Recusar
          </button>
        </div>
      </div>
    </div>
  )
}
