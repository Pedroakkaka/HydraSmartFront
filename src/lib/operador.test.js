import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, exigeChaveOperador } from './api.js';
import { FUSO, hora } from './formato.js';
import { esquecerChaveOperador, responderPedidoChave, useOperador } from '../store/useOperador.js';

const respostaJson = (status, corpo) => ({
  ok: status < 400,
  status,
  headers: { get: () => 'application/json' },
  json: async () => corpo
});

/** Responde o próximo pedido de chave assim que a janela abrir. */
function responderQuandoPedir(valor) {
  const parar = useOperador.subscribe((s) => {
    if (s.pedido) {
      parar();
      responderPedidoChave(valor);
    }
  });
}

afterEach(() => {
  esquecerChaveOperador();
  vi.unstubAllGlobals();
});

describe('regra da chave do operador (igual à do backend)', () => {
  it('exige a chave em ações de escrita', () => {
    expect(exigeChaveOperador('POST', '/serial/conectar')).toBe(true);
    expect(exigeChaveOperador('PUT', '/bueiros/bueiro_1/calibracao')).toBe(true);
    expect(exigeChaveOperador('DELETE', '/bueiros/2/coordenadas')).toBe(true);
    expect(exigeChaveOperador('POST', '/simulacao/iniciar?x=1')).toBe(true);
  });

  it('não exige em leituras, ingestão de sensores e IA', () => {
    expect(exigeChaveOperador('GET', '/estado')).toBe(false);
    expect(exigeChaveOperador('POST', '/leituras')).toBe(false);
    expect(exigeChaveOperador('POST', '/ia/analisar')).toBe(false);
  });
});

describe('envio da chave', () => {
  it('pede a chave uma vez, envia no cabeçalho e reutiliza na próxima ação', async () => {
    const fetch = vi.fn(async () => respostaJson(200, { ok: true }));
    vi.stubGlobal('fetch', fetch);

    responderQuandoPedir('segredo');
    await api.post('/simulacao/iniciar', {});
    await api.put('/bueiros/1/calibracao', { alturaTotalCm: 20 });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1].headers['X-Operator-Key']).toBe('segredo');
    expect(fetch.mock.calls[1][1].headers['X-Operator-Key']).toBe('segredo');
  });

  it('pede de novo quando o servidor recusa a chave', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(respostaJson(401, { erro: 'Chave de operador necessária.' }))
      .mockResolvedValueOnce(respostaJson(200, { ok: true }));
    vi.stubGlobal('fetch', fetch);
    useOperador.setState({ chave: 'errada' });

    responderQuandoPedir('certa');
    await api.post('/serial/desconectar');

    expect(fetch.mock.calls[1][1].headers['X-Operator-Key']).toBe('certa');
    expect(useOperador.getState().chave).toBe('certa');
  });

  it('não chama a API quando o operador cancela', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    responderQuandoPedir(null);
    await expect(api.post('/simulacao/encerrar')).rejects.toMatchObject({ cancelado: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('leituras não pedem chave', async () => {
    const fetch = vi.fn(async () => respostaJson(200, {}));
    vi.stubGlobal('fetch', fetch);
    await api.get('/estado');
    expect(fetch.mock.calls[0][1].headers['X-Operator-Key']).toBeUndefined();
    expect(useOperador.getState().pedido).toBeNull();
  });
});

describe('fuso horário', () => {
  it('usa o horário de Porto Alegre (GMT-3)', () => {
    expect(FUSO).toBe('America/Sao_Paulo');
    expect(hora('2026-11-06T22:20:19Z')).toBe('19:20:19');
  });
});
