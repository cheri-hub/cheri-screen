import { describe, expect, it } from 'vitest';
import { lerConfig } from './config.js';

describe('lerConfig', () => {
  it('falha quando o segredo do LiveKit está ausente', () => {
    expect(() => lerConfig({ LIVEKIT_API_KEY: 'k' })).toThrow(
      /LIVEKIT_API_SECRET/,
    );
  });

  it('aplica os padrões de porta e URL do SFU', () => {
    const c = lerConfig({
      LIVEKIT_API_KEY: 'k',
      LIVEKIT_API_SECRET: 's',
      PUBLIC_HOST: 'share.exemplo.com',
    });
    expect(c.porta).toBe(3000);
    expect(c.livekitUrl).toBe('http://127.0.0.1:7880');
    expect(c.publicHost).toBe('share.exemplo.com');
  });
});
