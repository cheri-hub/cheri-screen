import { Link } from 'react-router-dom'

export function SalaExpirada() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-sm">
        <p className="hud-label mb-4 text-danger">sala fechada</p>
        <h1 className="font-display text-3xl font-bold uppercase leading-tight">
          Essa sala não existe mais
        </h1>
        <p className="mt-4 text-ink-dim">
          As salas somem sozinhas alguns minutos depois que todo mundo sai. Sem
          drama — abre outra.
        </p>
        <Link to="/" className="btn-cheri mt-8 inline-block px-6 py-3 text-sm">
          Criar uma nova
        </Link>
      </div>
    </main>
  )
}
