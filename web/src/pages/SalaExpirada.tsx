import { Link } from 'react-router-dom'

export function SalaExpirada() {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-950 p-6 text-center text-neutral-100">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Essa sala não existe mais</h1>
        <p className="text-neutral-400">
          As salas somem sozinhas alguns minutos depois que todo mundo sai.
        </p>
        <Link
          to="/"
          className="inline-block rounded-lg bg-emerald-500 px-4 py-2 font-medium text-neutral-950"
        >
          Criar uma nova
        </Link>
      </div>
    </main>
  )
}
