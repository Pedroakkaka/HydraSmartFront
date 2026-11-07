/**
 * Cliente HTTP da HydraSmart API.
 * Por padrão usa caminhos relativos (/api/v1), que o Vite (dev) e o nginx (produção)
 * repassam para a API. VITE_API_URL permite apontar para outro domínio.
 */

import { esquecerChaveOperador, obterChaveOperador } from '../store/useOperador.js';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const API_V1 = `${BASE}/api/v1`;

export function urlWebSocket() {
  const wsConfigurado = (import.meta.env.VITE_WS_URL || '').replace(/\/$/, '');
  if (wsConfigurado) return wsConfigurado;
  if (BASE) return `${BASE.replace(/^http/, 'ws')}/ws`;
  // A Vercel encaminha as rotas HTTP /api, mas não faz proxy de WebSocket.
  // Conectamos diretamente à API Render quando o painel está hospedado na Vercel.
  if (window.location.hostname.endsWith('.vercel.app')) {
    return 'wss://hydrasmartapi.onrender.com/ws';
  }
  const protocolo = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocolo}://${window.location.host}/ws`;
}

export class ErroApi extends Error {
  constructor(mensagem, status, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}

/**
 * Rotas de escrita que NÃO usam a chave do operador (mesma regra do backend em app.js):
 * leituras de sensores em campo (X-API-Key) e da ponte do protótipo (X-Prototype-Key).
 */
const SEM_CHAVE_OPERADOR = ['/leituras', '/leituras/prototipo'];

export function exigeChaveOperador(metodo, caminho) {
  const rota = caminho.split('?')[0];
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(metodo) && !SEM_CHAVE_OPERADOR.includes(rota);
}

async function enviar(metodo, caminho, corpo, headersExtras) {
  let resp;
  try {
    resp = await fetch(`${API_V1}${caminho}`, {
      method: metodo,
      headers: { ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headersExtras },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined
    });
  } catch {
    throw new ErroApi('Não foi possível falar com o servidor HydraSmart. Verifique se a API está rodando.', 0);
  }

  const tipo = resp.headers.get('content-type') || '';
  const dados = tipo.includes('application/json') ? await resp.json() : await resp.text();
  if (!resp.ok) {
    const msg = dados?.erro || `Erro ${resp.status} na API`;
    const detalhes = dados?.detalhes ? ` (${dados.detalhes.join('; ')})` : '';
    throw new ErroApi(msg + detalhes, resp.status, dados?.detalhes);
  }
  return dados;
}

function acaoCancelada() {
  const erro = new ErroApi('Ação cancelada: a chave do operador não foi informada.', 0);
  erro.cancelado = true;
  return erro;
}

/**
 * Executa a requisição. Nas ações de operador, anexa a chave (pedindo ao operador
 * se ainda não foi informada) e, se a API recusar a chave, pede de novo uma vez.
 */
async function requisitar(metodo, caminho, corpo, headersExtras = {}) {
  const chaveExplicita = Object.keys(headersExtras).some((h) => h.toLowerCase() === 'x-operator-key');
  // Quem já envia a chave (ex.: SeletorModo, que valida a chave digitada) segue sem a janela.
  if (chaveExplicita || !exigeChaveOperador(metodo, caminho)) return enviar(metodo, caminho, corpo, headersExtras);

  let chave = await obterChaveOperador();
  if (!chave) throw acaoCancelada();
  try {
    return await enviar(metodo, caminho, corpo, { ...headersExtras, 'X-Operator-Key': chave });
  } catch (erro) {
    if (erro.status !== 401) throw erro;
    esquecerChaveOperador();
    chave = await obterChaveOperador('Chave recusada pelo servidor. Confira e digite novamente.');
    if (!chave) throw acaoCancelada();
    try {
      return await enviar(metodo, caminho, corpo, { ...headersExtras, 'X-Operator-Key': chave });
    } catch (erro2) {
      if (erro2.status === 401) esquecerChaveOperador();
      throw erro2;
    }
  }
}

export const api = {
  get: (caminho, headers = {}) => requisitar('GET', caminho, undefined, headers),
  post: (caminho, corpo = {}, headers = {}) => requisitar('POST', caminho, corpo, headers),
  put: (caminho, corpo, headers = {}) => requisitar('PUT', caminho, corpo, headers),
  del: (caminho, headers = {}) => requisitar('DELETE', caminho, undefined, headers)
};

/** URL para downloads (CSV / JSON) servidos pela API. */
export const urlDownload = (caminho) => `${API_V1}${caminho}`;
