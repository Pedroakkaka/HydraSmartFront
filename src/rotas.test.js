import { describe, expect, it } from 'vitest';
import { ROTAS } from './rotas.js';

describe('rotas do painel', () => {
  it('registra as sete páginas de navegação, incluindo a simulação 3D', () => {
    expect(ROTAS.map(({ caminho }) => caminho)).toEqual([
      '/',
      '/mapa',
      '/bueiros',
      '/clima',
      '/graficos',
      '/diagnostico',
      '/simulacao-3d'
    ]);
  });
});
