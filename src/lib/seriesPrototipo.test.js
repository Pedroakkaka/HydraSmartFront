import { describe, expect, it } from 'vitest';
import { montarSeriesAoVivo } from './seriesPrototipo.js';

describe('gráficos das duas réguas físicas', () => {
  it('alinha horários independentes sem copiar dados entre B01 e B02', () => {
    const s = montarSeriesAoVivo(
      { historicoTimestamps: [1000, 3000], historicoNiveis: [16.7, 50] },
      { historicoTimestamps: [2000, 4000], historicoNiveis: [0, 33.3] }
    );
    expect(s.tempos).toEqual([1000, 2000, 3000, 4000]);
    expect(s.b1).toEqual([16.7, null, 50, null]);
    expect(s.b2).toEqual([null, 0, null, 33.3]);
    expect([s.amostrasB1, s.amostrasB2]).toEqual([2, 2]);
  });

  it('desenha subida e descida, sem inventar leituras faltantes', () => {
    const s = montarSeriesAoVivo(
      { historicoTimestamps: [1000, 2000, 3000], historicoNiveis: [16.7, 50, 33.3] },
      {}
    );
    expect(s.b1).toEqual([16.7, 50, 33.3]);
    expect(s.b2).toEqual([null, null, null]);
    expect(s.amostrasB2).toBe(0);
  });

  it('rejeita níveis inválidos e horários que não representam medições', () => {
    const s = montarSeriesAoVivo(
      { historicoTimestamps: [0, 1000, 2000, 3000, 4000],
        historicoNiveis: [50, null, -1, 120, 66.7] },
      { historicoTimestamps: [], historicoNiveis: [] }
    );
    expect(s.tempos).toEqual([4000]);
    expect(s.b1).toEqual([66.7]);
  });

  it('aceita timestamps numéricos serializados como texto', () => {
    expect(montarSeriesAoVivo(
      { historicoTimestamps: ['1000'], historicoNiveis: [16.7] },
      {}
    ).b1).toEqual([16.7]);
  });
});
