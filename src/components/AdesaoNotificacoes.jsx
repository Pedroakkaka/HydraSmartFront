import { useState } from 'react';
import { useNotificacoesTeste, TITULO_TESTE, TEXTO_TESTE, exibirNotificacaoTeste } from '../lib/notificacoesTeste.js';
import { useTelemetria } from '../store/useTelemetria.js';

export default function AdesaoNotificacoes() {
  const inscrito = useNotificacoesTeste(s => s.inscrito);
  const definirInscricao = useNotificacoesTeste(s => s.definirInscricao);
  const ultima = useNotificacoesTeste(s => s.ultima);
  const conexao = useTelemetria(s => s.conexao);
  const [mensagem, setMensagem] = useState('');
  const disponivel = typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext;
  const permissao = disponivel ? Notification.permission : 'unsupported';

  async function ativar() {
    if (!disponivel) { setMensagem('Este navegador não oferece notificações nesta página. Use HTTPS e verifique as permissões do aparelho.'); return; }
    try {
      const resultado = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (resultado !== 'granted') {
        setMensagem('O navegador não autorizou notificações. Altere a permissão nas configurações do site.');
        definirInscricao(false);
        return;
      }
      definirInscricao(true);
      setMensagem('Inscrição de teste ativada neste aparelho. Mantenha o site aberto e conectado.');
    } catch {
      setMensagem('Não foi possível solicitar a autorização neste navegador.');
    }
  }
  function desativar() {
    definirInscricao(false);
    setMensagem('Recebimento de alertas de teste desativado neste aparelho.');
  }
  function testar() {
    if (!inscrito) { setMensagem('Ative o recebimento antes de testar.'); return; }
    const enviado = exibirNotificacaoTeste();
    setMensagem(enviado ? 'Notificação local de teste exibida neste aparelho.' : 'O navegador não exibiu a notificação. Verifique as permissões e se a página está aberta.');
  }

  return <section className="hs-card hs-mobile-notifications" aria-label="Recebimento voluntário de notificações experimentais">
    <div className="hs-card-head">
      <h3><span className="hs-outline-icon">♧</span> Notificações de teste no celular</h3>
      <span className="hs-test-tag">SOMENTE DEMONSTRAÇÃO</span>
    </div>
    <div className="hs-mobile-notification-preview">
      <strong>{TITULO_TESTE}</strong>
      <p>{TEXTO_TESTE}</p>
    </div>
    <p className="hs-card-foot">
      Autorize neste próprio celular para receber avisos de ensaio do projeto físico quando houver alerta crítico.
      Não é um serviço de emergência, não substitui avisos oficiais e nunca envia mensagens à Defesa Civil.
    </p>
    <p className="hs-card-foot">
      As notificações em tempo real funcionam enquanto esta página estiver aberta e conectada à internet ou à rede que dá acesso ao servidor.
      Elas não dependem de estar no mesmo Wi-Fi; neste estágio, não são notificações push em segundo plano.
      No iPhone, a disponibilidade pode exigir adicionar o site à Tela de Início.
    </p>
    <div className="hs-mobile-notification-controls">
      {!inscrito
        ? <button type="button" className="btn-action-primary" onClick={ativar} disabled={!disponivel}>Ativar avisos de teste neste celular</button>
        : <button type="button" className="btn-action-secondary" onClick={desativar}>Desativar avisos neste celular</button>}
      <button type="button" className="btn-action-secondary" onClick={testar} disabled={!inscrito}>Testar notificação no meu celular</button>
    </div>
    <p className="hs-mobile-notification-status" role="status">
      {inscrito ? '● Cadastrado para testes' : '○ Não cadastrado'}
      {' · '}
      {permissao === 'granted' ? 'Permissão concedida' : permissao === 'denied' ? 'Permissão bloqueada' : 'Permissão não concedida'}
      {' · '}
      {conexao === 'online' ? 'Canal ao vivo conectado' : 'Canal ao vivo indisponível'}
    </p>
    {mensagem && <p className="hs-mobile-notification-status" role="status">{mensagem}</p>}
    {ultima && <p className="hs-mobile-notification-last" role="status">
      Último alerta experimental recebido neste aparelho: {new Date(ultima).toLocaleString('pt-BR')}. TESTE — nenhuma ação necessária.
    </p>}
  </section>;
}
