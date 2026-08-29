const CHAVE_ID = 'cheri-share:identidade'
const CHAVE_APELIDO = 'cheri-share:apelido'

export function obterIdentidade(): string {
  const existente = localStorage.getItem(CHAVE_ID)
  if (existente) return existente
  const nova = crypto.randomUUID()
  localStorage.setItem(CHAVE_ID, nova)
  return nova
}

export function obterApelido(): string | null {
  return localStorage.getItem(CHAVE_APELIDO)
}

export function salvarApelido(apelido: string): void {
  localStorage.setItem(CHAVE_APELIDO, apelido)
}
