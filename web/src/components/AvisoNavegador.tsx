import { capturaDeAudioSuportada } from '../lib/navegador'

/**
 * Alerta discreto para quem abre em navegador que não captura o áudio da tela
 * (Firefox, Safari). Não renderiza nada quando o navegador dá conta.
 */
export function AvisoNavegador() {
  if (capturaDeAudioSuportada()) return null

  return (
    <p className="text-xs text-amber-300">
      Seu navegador não captura o áudio da tela — a galera vai ver a imagem sem
      som. Chrome ou Edge resolvem.
    </p>
  )
}
