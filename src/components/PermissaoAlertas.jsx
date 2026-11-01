import { useState } from 'react';
import { avisar } from '../store/useTelemetria.js';
import { useNotificacoesTeste } from '../lib/notificacoesTeste.js';

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
        avisar('Avisos experimentais ativados. O envio será automático quando o sensor atingir o limite.', 'sucesso');
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

  return <button
    type="button"
    className={`hs-alerts-icon ${ativo ? 'enabled' : ''}`}
    onClick={configurar}
    disabled={ocupado}
    title={ativo
      ? 'Avisos automáticos de teste ativos. Toque para desativar.'
      : 'Ativar avisos automáticos de teste neste aparelho (autorização única)'}
    aria-label={ativo
      ? 'Avisos automáticos de teste ativados; toque para desativar'
      : 'Ativar avisos automáticos experimentais neste celular'}
    aria-pressed={ativo}
  >
    <span aria-hidden="true">{ativo ? '♧' : '♧'}</span>
    <span className="hs-alerts-icon-text">{ativo ? 'Avisos ativos' : 'Ativar avisos'}</span>
  </button>;
}
