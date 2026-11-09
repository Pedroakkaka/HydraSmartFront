import { useState } from 'react';
import { avisar } from '../store/useTelemetria.js';
import { exibirNotificacaoTeste, useNotificacoesTeste } from '../lib/notificacoesTeste.js';

// Controle discreto e voluntário: o site não pode autorizar notificações por conta própria.
// Depois de uma única autorização, os alertas experimentais chegam automaticamente.
export default function PermissaoAlertas() {
  const inscrito = useNotificacoesTeste(s => s.inscrito);
  const definirInscricao = useNotificacoesTeste(s => s.definirInscricao);
  const disponivel = typeof window !== 'undefined'
    && window.isSecureContext && 'Notification' in window;
  const [autorizacao, setAutorizacao] = useState(
    disponivel ? Notification.permission : 'unsupported'
  );
  const [ocupado, setOcupado] = useState(false);
  const ativo = disponivel && inscrito && autorizacao === 'granted';

  async function configurar() {
    if (!disponivel) {
      avisar('Este navegador não permite notificações nesta página.', 'erro');
      return;
    }
    if (ativo) {
      definirInscricao(false);
      avisar('Avisos de teste desativados neste aparelho.', 'info');
      return;
    }
    setOcupado(true);
    try {
      const resultado = Notification.permission === 'granted'
        ? 'granted' : await Notification.requestPermission();
      setAutorizacao(resultado);
      if (resultado === 'granted') {
        definirInscricao(true);
        avisar('Avisos de simulação ativados neste aparelho, inclusive ao visualizar dados reais (com o site aberto).', 'sucesso');
      } else {
        definirInscricao(false);
        avisar('Para receber os avisos de teste, permita notificações nas configurações deste site.', 'info');
      }
    } catch {
      avisar('Não foi possível ativar as notificações neste aparelho.', 'erro');
    } finally {
      setOcupado(false);
    }
  }

  async function testarAviso() {
    const enviado = await exibirNotificacaoTeste();
    avisar(enviado
      ? 'Aviso de teste solicitado ao navegador. Confira a central de notificações.'
      : 'O navegador recusou o aviso. Confira as permissões e o suporte a notificações.',
      enviado ? 'sucesso' : 'erro');
  }

  return <span className="inline-flex items-center gap-1 flex-wrap"><button
    type="button"
    className={`hs-alerts-icon ${ativo ? 'enabled' : ''}`}
    onClick={configurar}
    disabled={ocupado}
    title={ativo
      ? 'Avisos de simulação e protótipo ativos, mesmo ao visualizar dados reais. Requer página aberta; toque para desativar.'
      : 'Ativar avisos de simulação nos celulares, mesmo na análise de dados reais; requer este site aberto'}
    aria-label={ativo
      ? 'Avisos automáticos de teste ativados; toque para desativar'
      : 'Ativar avisos automáticos experimentais neste celular'}
    aria-pressed={ativo}
  >
    <span aria-hidden="true">{ativo ? '🔔' : '🔕'}</span>
    <span className="hs-alerts-icon-text">{ativo ? 'Avisos ativos' : 'Ativar avisos'}</span>
  </button>{ativo && <button type="button" className="hs-alerts-icon" onClick={testarAviso} title="Enviar notificação local de teste (não é emergência)" aria-label="Testar notificação deste dispositivo">Testar aviso</button>}</span>;
}
