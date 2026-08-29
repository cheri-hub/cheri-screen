interface ParticipantesProps {
  nomes: string[]
}

export function Participantes({ nomes }: ParticipantesProps) {
  return (
    <div>
      <p className="hud-label mb-2">na sala · {nomes.length}</p>
      <ul className="roster flex flex-wrap gap-2">
        {nomes.map((nome, i) => (
          <li
            key={`${nome}-${i}`}
            className="chanfro flex items-center border border-line bg-panel py-2 pr-3 font-mono text-sm text-ink"
          >
            {nome}
          </li>
        ))}
      </ul>
    </div>
  )
}
