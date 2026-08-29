import { describe, expect, it, vi } from 'vitest';
import { capturaDeAudioSuportada } from './navegador';

function comUserAgent(ua: string) {
  vi.stubGlobal('navigator', { userAgent: ua });
}

describe('capturaDeAudioSuportada', () => {
  it('aceita Chrome', () => {
    comUserAgent('Mozilla/5.0 Chrome/130.0 Safari/537.36');
    expect(capturaDeAudioSuportada()).toBe(true);
  });

  it('rejeita Safari', () => {
    comUserAgent('Mozilla/5.0 Version/17.0 Safari/605.1.15');
    expect(capturaDeAudioSuportada()).toBe(false);
  });
});
