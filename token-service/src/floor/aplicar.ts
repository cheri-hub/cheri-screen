import { api } from '../livekit.js';
import { emSerie } from '../serie.js';
import { decide } from './decide.js';
import { ESTADO_VAZIO, type Decisao, type EstadoDaVez, type Evento } from './types.js';

function permissao(canPublish: boolean) {
  return { permission: { canSubscribe: true, canPublish, canPublishData: true } };
}

function lerEstado(metadata: string | undefined): EstadoDaVez {
  if (!metadata) return ESTADO_VAZIO;
  try {
    const bruto = JSON.parse(metadata) as Partial<EstadoDaVez>;
    return { sharer: bruto.sharer ?? null, pending: bruto.pending ?? null };
  } catch {
    return ESTADO_VAZIO;
  }
}

/** Resolve o evento e aplica os efeitos. `null` quando a sala não existe. */
export function aplicar(salaId: string, evento: Evento): Promise<Decisao | null> {
  return emSerie(salaId, async () => {
    const [sala] = await api.room.listRooms([salaId]);
    if (!sala) return null;

    const participantes = await api.room.listParticipants(salaId);
    const presentes = participantes.map((p) => p.identity);

    const { estado, decisao } = decide(
      lerEstado(sala.metadata),
      presentes,
      Date.now(),
      evento,
    );

    if (decisao.resultado === 'concedido') {
      if (decisao.revogarDe) {
        await api.room.updateParticipant(salaId, decisao.revogarDe, permissao(false));
      }
      await api.room.updateParticipant(salaId, decisao.para, permissao(true));
    } else if (decisao.resultado === 'liberado') {
      await api.room.updateParticipant(salaId, decisao.revogarDe, permissao(false));
    }

    await api.room.updateRoomMetadata(salaId, JSON.stringify(estado));
    return decisao;
  });
}
