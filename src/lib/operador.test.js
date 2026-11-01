import { describe, expect, it } from 'vitest';
import { cabecalhoOperador } from './operador.js';

describe('cabeçalho de operador', () => {
  it('normaliza a chave para uma requisição administrativa', () => {
    expect(cabecalhoOperador('  chave temporária  ')).toEqual({ 'X-Operator-Key': 'chave temporária' });
  });

  it('não cria cabeçalho para chave ausente ou vazia', () => {
    expect(cabecalhoOperador(null)).toBeNull();
    expect(cabecalhoOperador('   ')).toBeNull();
  });
});
