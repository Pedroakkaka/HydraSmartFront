/**
 * Cliente HTTP da HydraSmart API.
 * Por padrão usa caminhos relativos (/api/v1), que o Vite (dev) e o nginx (produção)
 * repassam para a API. VITE_API_URL permite apontar para outro domínio.
 */

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const API_V1 = `${BASE}/api/v1`;

export function urlWebSocket() {
  if (BASE) return `${BASE.replace(/^http/, 'ws')}/ws`;
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

async function requisitar(metodo, caminho, corpo) {
  let resp;
  try {
    resp = await fetch(`${API_V1}${caminho}`, {
      method: metodo,
      headers: corpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
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

export const api = {
  get: (caminho) => requisitar('GET', caminho),
  post: (caminho, corpo = {}) => requisitar('POST', caminho, corpo),
  put: (caminho, corpo) => requisitar('PUT', caminho, corpo),
  del: (caminho) => requisitar('DELETE', caminho)
};

/** URL para downloads (CSV / JSON) servidos pela API. */
export const urlDownload = (caminho) => `${API_V1}${caminho}`;
