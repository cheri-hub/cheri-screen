export const ESPERA_MS = 30_000;

export type Vez = { identity: string; nome: string; desde: number };
export type Pedido = { identity: string; nome: string; expiraEm: number };

export type EstadoDaVez = { sharer: Vez | null; pending: Pedido | null };

export const ESTADO_VAZIO: EstadoDaVez = { sharer: null, pending: null };

export type Evento =
  | { tipo: 'pedir'; identity: string; nome: string }
  | { tipo: 'responder'; identity: string; aceita: boolean }
  | { tipo: 'liberar'; identity: string };

export type Decisao =
  | { resultado: 'concedido'; para: string; revogarDe: string | null }
  | { resultado: 'aguardando'; dono: string }
  | { resultado: 'ocupado' }
  | { resultado: 'recusado' }
  | { resultado: 'liberado'; revogarDe: string }
  | { resultado: 'ignorado'; motivo: string };

export type Resultado = { estado: EstadoDaVez; decisao: Decisao };
