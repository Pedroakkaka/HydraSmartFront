import { describe, expect, it, vi } from 'vitest';
import { estimarTempoExtravasamento, avaliarCondicaoObservada } from './indicadoresReais.js';

describe('indicadores com dados reais', () => {
  it('não cria ETA quando não há sensores de campo', () => {
    const resultado = estimarTempoExtravasamento({});
    expect(resultado.natureza).toBe('indisponivel');
    expect(resultado.valor).toBe('Não calculável');
  });
  it('calcula ETA experimental apenas para série recente e ascendente', () => {
    const agora = Date.now();
    const sensor = {id:'bueiro_1',conectado:true,valido:true,desatualizado:false,nivelPct:70,
      historicoTimestamps:[4,3,2,1,0].map(min => agora - min*60000),
      historicoNiveis:[50,55,60,65,70] };
    const resultado = estimarTempoExtravasamento({bueiro_1:sensor});
    expect(resultado.natureza).toBe('estimativa');
    expect(resultado.valor).toMatch(/min/);
    expect(resultado.detalhe).toContain('Não é previsão validada');
  });
  it('não confunde nível de estação oficial com nível do bueiro', () => {
    const estacao = {codigo:'DCRS-00054',rio:{nivelMetros:2.7,tendenciaMetros:0.08,situacaoOficial:'Atenção'}};
    const condicao = avaliarCondicaoObservada(estacao,null);
    expect(condicao.valor).toBe('Atenção');
    expect(condicao.detalhe).toContain('2,7 m');
    expect(condicao.detalhe).toContain('não probabilidade para 6 h');
    expect(estimarTempoExtravasamento({}).natureza).toBe('indisponivel');
  });
  it('não inventa categoria normal quando a fonte é desconhecida', () => {
    expect(avaliarCondicaoObservada(null,null).natureza).toBe('indisponivel');
  });
});
