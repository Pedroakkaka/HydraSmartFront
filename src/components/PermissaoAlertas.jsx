import { useEffect, useState } from 'react';
import { avisar } from '../store/useTelemetria.js';
import { exibirNotificacaoTeste, useNotificacoesTeste } from '../lib/notificacoesTeste.js';
import { inscreverCelular, cancelarInscricaoCelular, suportaPushRemoto } from '../lib/pushRemoto.js';

// Controle discreto e voluntário: o site não pode autorizar notificações por conta própria.
// Depois de uma única autorização, os alertas experimentais chegam automaticamente.
export default function PermissaoAlertas() {
  const inscrito = useNotificacoesTeste(s => s.inscrito);
  const definirInscricao = useNotificacoesTeste(s => s.definirInscricao);
  const definirPush = useNotificacoesTeste(s => s.definirPush);
  const pushAtivo = useNotificacoesTeste(s => s.pushAtivo);
  const pushErro = useNotificacoesTeste(s => s.pushErro);
  const disponivel = typeof window !== 'undefined'
    && window.isSecureContext && 'Notification' in window;
  const [autorizacao, setAutorizacao] = useState(
    disponivel ? Notification.permission : 'unsupported'
  );
  const [ocupado, setOcupado] = useState(false);
  const ativo = disponivel && inscrito && autorizacao === 'granted';

  useEffect(() => {
    if (!ativo || !suportaPushRemoto() || pushAtivo) return;
    let cancelado = false;
    inscreverCelular().then(() => {
      if (!cancelado) definirPush(true);
    }).catch(err => {
      if (!cancelado) definirPush(false, err.message);
    });
    return () => { cancelado = true; };
  }, [ativo, pushAtivo, definirPush]);

  async function configurar() {
    if (!disponivel) {
      avisar('Este navegador não permite notificações nesta página.', 'erro');
      return;
    }
    if (ativo) {
      definirInscricao(false);
      definirPush(false);
      await cancelarInscricaoCelular().catch(() => {});
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
        try {
          await inscreverCelular();
          definirPush(true);
          avisar('Celular inscrito para receber alertas remotos de SIMULAÇÃO, mesmo no modo Dados reais.', 'sucesso');
        } catch (err) {
          definirPush(false, err.message);
          avisar('Permissão concedida, mas o envio remoto ainda não está disponível: ' + err.message, 'erro');
        }
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
    <span className="hs-alerts-icon-text">{pushAtivo ? 'Push ativo' : ativo ? 'Permissão concedida' : 'Ativar avisos'}</span>
  </button>{ativo && pushErro && <span className="text-xs text-amber-400" role="status">Push remoto não ativo: {pushErro}</span>}{ativo && <button type="button" className="hs-alerts-icon" onClick={testarAviso} title="Enviar notificação local de teste (não é emergência)" aria-label="Testar notificação deste dispositivo">Testar aviso</button>}</span>;
}
