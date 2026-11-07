import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api.js';

const resposta = () => ({
  ok: true,
  headers: { get: () => 'application/json' },
  json: async () => ({ ok: true })
});

afterEach(() => vi.unstubAllGlobals());

describe('cliente HTTP administrativo', () => {
  it('encaminha o cabeçalho de operador em PUT', async () => {
    const fetch = vi.fn().mockResolvedValue(resposta());
    vi.stubGlobal('fetch', fetch);

    await api.put('/bueiros/1/calibracao', { alturaTotalCm: 20 }, { 'X-Operator-Key': 'test-key' });

    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'PUT',
      headers: { 'X-Operator-Key': 'test-key' }
    });
  });

  it('encaminha o cabeçalho de operador em DELETE', async () => {
    const fetch = vi.fn().mockResolvedValue(resposta());
    vi.stubGlobal('fetch', fetch);

    await api.del('/bueiros/1/coordenadas', { 'X-Operator-Key': 'test-key' });

    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      headers: { 'X-Operator-Key': 'test-key' }
    });
  });
});
