import { describe, expect, it } from 'vitest';
import { lerMetrica } from './metricas.js';

const TEXTO = `# HELP livekit_node_bytes_out bytes
# TYPE livekit_node_bytes_out counter
livekit_node_bytes_out{node_id="a",direction="out"} 1200
livekit_node_bytes_out{node_id="b",direction="out"} 300
outra_metrica 999
`;

describe('lerMetrica', () => {
  it('soma todas as séries da métrica', () => {
    expect(lerMetrica(TEXTO, 'livekit_node_bytes_out')).toBe(1500);
  });

  it('devolve null quando a métrica não existe', () => {
    expect(lerMetrica(TEXTO, 'inexistente')).toBeNull();
  });
});
