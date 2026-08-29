import { describe, expect, it } from 'vitest';
import { acumular, type Contador } from './acumular.js';

const marco = new Date('2026-03-10T12:00:00Z');
const base: Contador = { mes: '2026-03', bytes: 100, ultimaLeitura: 1000 };

describe('acumular', () => {
  it('registra a primeira leitura sem somar nada', () => {
    const r = acumular({ mes: '2026-03', bytes: 0, ultimaLeitura: null }, 500, marco);
    expect(r).toEqual({ mes: '2026-03', bytes: 0, ultimaLeitura: 500 });
  });

  it('soma apenas o delta entre leituras', () => {
    expect(acumular(base, 1300, marco)).toEqual({
      mes: '2026-03', bytes: 400, ultimaLeitura: 1300,
    });
  });

  it('zera o acumulado na virada do mês', () => {
    const r = acumular(base, 1300, new Date('2026-04-01T00:00:00Z'));
    expect(r).toEqual({ mes: '2026-04', bytes: 0, ultimaLeitura: 1300 });
  });

  it('não soma salto quando o LiveKit reinicia e o contador zera', () => {
    expect(acumular(base, 5, marco)).toEqual({
      mes: '2026-03', bytes: 100, ultimaLeitura: 5,
    });
  });
});
