import { describe, expect, it } from 'vitest';
import { metaRisco, situacaoGeral, temLeitura } from './risco.js';
import { num } from './formato.js';

const bueiro = (risco, conectado = true) => ({ conectado, valido: conectado, risco });

describe('risco', () => {
  it('traduz o risco calculado pela API em rótulo e classe visual', () => {
    expect(metaRisco('critico')).toMatchObject({ rotulo: 'Crítico', classe: 'danger' });
    expect(metaRisco('atencao').classe).toBe('warning');
    expect(metaRisco('qualquer-coisa').rotulo).toBe('Sem Sinal');
  });

  it('considera só bueiros com leitura válida', () => {
    expect(temLeitura(bueiro('normal'))).toBe(true);
    expect(temLeitura(bueiro('critico', false))).toBe(false);
  });

  it('situação geral assume o pior risco entre os bueiros com leitura', () => {
    expect(situacaoGeral({ a: bueiro('normal'), b: bueiro('atencao') })).toBe('atencao');
    expect(situacaoGeral({ a: bueiro('critico'), b: bueiro('atencao') })).toBe('critico');
    expect(situacaoGeral({ a: bueiro('critico', false) })).toBe('normal');
  });
});

describe('formato', () => {
  it('formata números com reserva para valores ausentes', () => {
    expect(num(12.345)).toBe('12.3');
    expect(num(null)).toBe('--');
    expect(num(undefined, 1, '0.0')).toBe('0.0');
  });
});
