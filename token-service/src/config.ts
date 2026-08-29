export type Config = {
  apiKey: string;
  apiSecret: string;
  livekitUrl: string;
  publicHost: string;
  porta: number;
  metricaConsumo: string;
  urlConsumo: string;
  arquivoConsumo: string;
};

function obrigatorio(env: NodeJS.ProcessEnv, chave: string): string {
  const valor = env[chave];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${chave}`);
  return valor;
}

export function lerConfig(env: NodeJS.ProcessEnv): Config {
  return {
    apiKey: obrigatorio(env, 'LIVEKIT_API_KEY'),
    apiSecret: obrigatorio(env, 'LIVEKIT_API_SECRET'),
    livekitUrl: env.LIVEKIT_URL ?? 'http://127.0.0.1:7880',
    publicHost: obrigatorio(env, 'PUBLIC_HOST'),
    porta: Number(env.PORT ?? 3000),
    metricaConsumo: env.USAGE_METRIC ?? 'livekit_node_bytes_out',
    urlConsumo: env.USAGE_URL ?? 'http://127.0.0.1:6789/metrics',
    arquivoConsumo: env.USAGE_FILE ?? '/dados/consumo.json',
  };
}

export const config = lerConfig(process.env);
