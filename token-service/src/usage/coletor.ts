import { config } from '../config.js';
import { acumular, CONTADOR_VAZIO, type Contador } from './acumular.js';
import { buscarMetricas, lerMetrica } from './metricas.js';
import { carregar, salvar } from './store.js';

let contador: Contador = CONTADOR_VAZIO;

export const consumoAtual = (): Contador => contador;

/** Coleta a cada 60s. Falha de leitura é logada e ignorada: o medidor nunca derruba o serviço. */
export async function iniciarColeta(
  log: (msg: string) => void,
): Promise<NodeJS.Timeout> {
  contador = await carregar(config.arquivoConsumo);

  return setInterval(async () => {
    try {
      const texto = await buscarMetricas(config.urlConsumo);
      const bytes = lerMetrica(texto, config.metricaConsumo);
      if (bytes === null) {
        log(`métrica ${config.metricaConsumo} não encontrada`);
        return;
      }
      contador = acumular(contador, bytes, new Date());
      await salvar(config.arquivoConsumo, contador);
    } catch (erro) {
      log(`falha ao coletar consumo: ${String(erro)}`);
    }
  }, 60_000);
}
