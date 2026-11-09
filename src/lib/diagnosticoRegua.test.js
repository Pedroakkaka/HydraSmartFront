import { describe, expect, it } from 'vitest';
import { diagnosticarRegua } from './diagnosticoRegua.js';
const agora = 1800000000000;
const serie = valores => ({
  tempos: valores.map((_,i) => agora - (valores.length-i-1)*5000),
  niveis: valores
});
const calcular = valores => {
  const { niveis, tempos } = serie(valores);
  return diagnosticarRegua(niveis, tempos, agora);
};
describe('diagnóstico experimental USB', () => {
  it('não calcula ETA a partir de um único salto', () => {
    const d=calcular([0,0,0,0,0,0,16.7,16.7,16.7,16.7]);
    expect(d.confiavel).toBe(false);
    expect(d.tempoAte100Min).toBe(null);
  });
  it('aceita subida estável observada por 25 segundos ou mais', () => {
    const d=calcular([0,0,16.7,16.7,33.3,33.3,50,50,66.7,66.7]);
    expect(d.confiavel).toBe(true);
    expect(d.tendencia).toBe('subindo');
    expect(d.tempoAte100Min).toBeGreaterThan(0);
  });
  it('não prevê enchimento durante descida ou nível estável', () => {
    expect(calcular([66.7,66.7,50,50,33.3,33.3,16.7,16.7,0,0]).confiavel).toBe(false);
    expect(calcular(Array(10).fill(33.3)).tempoAte100Min).toBe(null);
  });
  it('não interpreta uma leitura velha como previsão atual', () => {
    const d=diagnosticarRegua([16.7,33.3], [agora-60000,agora-59000], agora);
    expect(d.confiavel).toBe(false);
    expect(d.tempoAte100Min).toBe(null);
  });
  it('reconhece 100% como medição e não previsão', () => {
    const d=calcular([100]);
    expect(d.tempoAte100Min).toBe(0);
    expect(d.confiavel).toBe(false);
  });
});
