import { create } from 'zustand';

// A inscrição é local ao navegador. Nenhum telefone ou cadastro pessoal é coletado.
const CHAVE = 'hydrasmart-notificacoes-teste-v1';
const ler = () => {
  try { return window.localStorage.getItem(CHAVE) === 'sim'; }
  catch { return false; }
};
export const useNotificacoesTeste = create((set) => ({
  inscrito: ler(),
  ultima: null,
  pushAtivo: false,
  pushErro: null,
  definirPush: (pushAtivo, pushErro = null) => set({ pushAtivo, pushErro }),
  definirInscricao: inscrito => {
    try {
      if (inscrito) window.localStorage.setItem(CHAVE, 'sim');
      else window.localStorage.removeItem(CHAVE);
    } catch { /* Modo privado: consentimento vale somente nesta sessão. */ }
    set({ inscrito: Boolean(inscrito) });
  },
  receber: ultima => set({ ultima })
}));

export const TITULO_TESTE = 'TESTE DO SISTEMA — NÃO É EMERGÊNCIA';
export const TEXTO_TESTE = 'Teste do protótipo HydraSmart. Não há emergência real. Nenhuma ação é necessária.';

// Exige simultaneamente origem simulada e assinatura do protótipo.
// Mensagens de campo, histórico e simulador virtual não são notificadas.
export function ehAlertaProtótipo(dados) {
  const a = dados?.alerta;
  return (dados?.acao === 'disparado' || dados?.acao === 'nivel_alto_teste')
    && a?.simulado === true
    && typeof a?.mensagem === 'string'
    && a.mensagem.startsWith('[TESTE PROTÓTIPO]');
}

// Alertas digitais do projeto são estritamente rotulados como simulação.
export function ehAlertaSimulacao(dados) {
  const a = dados?.alerta;
  return (dados?.acao === 'disparado' || dados?.acao === 'nivel_alto_teste')
    && a?.simulado === true
    && typeof a?.mensagem === 'string'
    && a.mensagem.startsWith('[TESTE SIMULAÇÃO]');
}
export const ehAlertaDeTeste = dados => ehAlertaProtótipo(dados) || ehAlertaSimulacao(dados);
export function classificarFaixaTeste(nivel, atencao = 50, critico = 80) {
  const n = Number(nivel);
  if (nivel == null || !Number.isFinite(n) || n < 0 || n > 100) return null;
  return n >= critico ? 'critico' : n >= atencao ? 'atencao' : 'normal';
}

export async function exibirNotificacaoTeste(evento = null) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  const nivel = evento?.alerta?.nivelPctPico;
  const simDigital = ehAlertaSimulacao(evento);
  const prototipo = ehAlertaProtótipo(evento);
  const percentual = typeof nivel === 'number' && Number.isFinite(nivel)
    ? `${nivel.toFixed(1)}%` : 'nível alto';
  const origem = simDigital ? 'SIMULAÇÃO DIGITAL DO PROJETO'
    : prototipo ? 'ENSAIO DO PROTÓTIPO FÍSICO' : 'TESTE MANUAL';
  const id = evento?.alerta?.bueiroId;
  const bueiro = id === 'bueiro_1' ? 'Bueiro 01' : id === 'bueiro_2' ? 'Bueiro 02' : 'HydraSmart';
  const descricao = simDigital || prototipo
    ? `${origem} — ${bueiro}: ${percentual}. DADO SIMULADO/EXPERIMENTAL. NÃO É EMERGÊNCIA REAL. Nenhuma ação necessária.`
    : TEXTO_TESTE;
  const opcoes = {
    body: descricao,
    tag: `hydrasmart-teste-${simDigital ? 'simulacao' : 'prototipo'}-${id || 'manual'}`,
    icon: '/hydrasmart-h.svg',
    silent: true,
    requireInteraction: false
  };
  try {
    // O método showNotification é necessário em muitos navegadores de celular.
    if ('serviceWorker' in navigator) {
      const registro = await navigator.serviceWorker.register('/hydrasmart-testes-sw.js');
      await registro.showNotification(simDigital ? 'SIMULAÇÃO HYDRASMART — NÃO É EMERGÊNCIA' : TITULO_TESTE, opcoes);
      return true;
    }
    const aviso = new Notification(simDigital ? 'SIMULAÇÃO HYDRASMART — NÃO É EMERGÊNCIA' : TITULO_TESTE, opcoes);
    aviso.onclick = () => { window.focus(); aviso.close(); };
    return true;
  } catch { return false; }
}
