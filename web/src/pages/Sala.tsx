import { useParams } from 'react-router-dom'

// Placeholder temporário — a Task 5 substitui por sala completa.
export function Sala() {
  const { id } = useParams()

  return (
    <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-100 p-6">
      <p className="text-neutral-300">Sala {id}</p>
    </main>
  )
}
