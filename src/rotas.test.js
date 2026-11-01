import { describe, expect, it } from 'vitest';
import { ROTAS } from './rotas.js';

describe('rotas do painel', () => {
  it('registra as seis páginas de navegação', () => {
    expect(ROTAS.map(({ caminho }) => caminho)).toEqual([
      '/',
      '/mapa',
      '/bueiros',
      '/clima',
      '/graficos',
      '/diagnostico'
    ]);
  });
});
