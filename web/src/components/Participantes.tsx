interface ParticipantesProps {
  nomes: string[]
}

export function Participantes({ nomes }: ParticipantesProps) {
  return (
    <ul className="space-y-1">
      {nomes.map((nome, i) => (
        <li
          key={`${nome}-${i}`}
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
        >
          {nome}
        </li>
      ))}
    </ul>
  )
}
