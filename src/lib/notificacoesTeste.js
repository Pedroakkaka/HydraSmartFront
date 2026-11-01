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
  return dados?.acao === 'disparado'
    && a?.simulado === true
    && typeof a?.mensagem === 'string'
    && a.mensagem.startsWith('[TESTE PROTÓTIPO]');
}

export function exibirNotificacaoTeste() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const aviso = new Notification(TITULO_TESTE, {
      body: TEXTO_TESTE,
      tag: 'hydrasmart-teste-experimental',
      icon: '/hydrasmart-h.svg',
      silent: true,
      requireInteraction: false
    });
    aviso.onclick = () => { window.focus(); aviso.close(); };
    return true;
  } catch {
    return false;
  }
}
