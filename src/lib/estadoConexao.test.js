import { describe, expect, it } from 'vitest';
import { necessitaFallbackHttp } from './estadoConexao.js';

describe('fallback de telemetria', () => {
  it('consulta HTTP se conexão não existe ou ainda não abriu', () => {
    expect(necessitaFallbackHttp(undefined)).toBe(true);
    expect(necessitaFallbackHttp({readyState:0})).toBe(true);
  });
  it('não duplica GET quando o WebSocket está aberto', () => {
    expect(necessitaFallbackHttp({readyState:1})).toBe(false);
  });
  it('retoma fallback após desconexão', () => {
    expect(necessitaFallbackHttp({readyState:2})).toBe(true);
    expect(necessitaFallbackHttp({readyState:3})).toBe(true);
  });
});
