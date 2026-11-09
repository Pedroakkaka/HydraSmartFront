import { api } from './api.js';

function chaveAplicacao(valor) {
  const base64 = valor.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64.padEnd(Math.ceil(base64.length/4)*4, '='));
  return Uint8Array.from(binario, c => c.charCodeAt(0));
}

export function suportaPushRemoto() {
  return typeof window !== 'undefined' && window.isSecureContext &&
    'serviceWorker' in navigator && 'PushManager' in window &&
    'Notification' in window;
}

/**
 * Registra este aparelho no servidor, independentemente da fonte de dados
 * selecionada no painel. A permissão deve ter sido concedida pelo visitante.
 */
let registroPendente = null;
export function inscreverCelular() {
  if (!registroPendente) {
    registroPendente = registrarCelular().finally(() => { registroPendente = null; });
  }
  return registroPendente;
}

async function registrarCelular() {
  if (!suportaPushRemoto()) throw new Error('Web Push não suportado neste navegador. No iPhone, adicione o site à Tela de Início.');
  if (Notification.permission !== 'granted') throw new Error('Permissão de notificações não concedida.');
  const config = await api.get('/push/publica');
  if (!config.disponivel || !config.chavePublica) {
    throw new Error('O servidor ainda não está configurado para enviar notificações aos celulares.');
  }
  const registro = await navigator.serviceWorker.register('/hydrasmart-testes-sw.js', { scope: '/' });
  const pronto = await navigator.serviceWorker.ready;
  let inscricao = await pronto.pushManager.getSubscription();
  const novaChave = chaveAplicacao(config.chavePublica);
  const anterior = inscricao?.options?.applicationServerKey;
  if (inscricao && anterior &&
      !Array.from(new Uint8Array(anterior)).every((v, i) => v === novaChave[i])) {
    await inscricao.unsubscribe();
    inscricao = null;
  }
  if (!inscricao) {
    inscricao = await pronto.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:novaChave
    });
  }
  try {
    await api.post('/push/inscrever', inscricao.toJSON());
  } catch (err) {
    throw new Error('Falha ao registrar o celular no servidor: ' + err.message);
  }
  return { ativo:true, endpoint:inscricao.endpoint, registro };
}

export async function cancelarInscricaoCelular() {
  if (!suportaPushRemoto()) return false;
  const registro = await navigator.serviceWorker.getRegistration('/hydrasmart-testes-sw.js');
  const inscricao = await registro?.pushManager.getSubscription();
  if (!inscricao) return true;
  try {
    await api.post('/push/cancelar', { endpoint:inscricao.endpoint });
  } finally {
    await inscricao.unsubscribe();
  }
  return true;
}

export async function verificarInscricaoCelular() {
  if (!suportaPushRemoto() || Notification.permission !== 'granted') return false;
  const registro = await navigator.serviceWorker.getRegistration('/hydrasmart-testes-sw.js');
  return Boolean(await registro?.pushManager.getSubscription());
}
