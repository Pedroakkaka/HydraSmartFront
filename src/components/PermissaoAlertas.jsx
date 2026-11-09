import { useEffect, useState } from 'react';
import { avisar } from '../store/useTelemetria.js';
import { api } from '../lib/api.js';
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
  const [enviandoTeste, setEnviandoTeste] = useState(false);
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

  async function testarAvisoLocal() {
    const solicitado = await exibirNotificacaoTeste();
    avisar(solicitado
      ? 'O navegador recebeu o pedido de exibição local; confira a central de notificações. Isso não confirma entrega remota.'
      : 'O navegador não conseguiu exibir o aviso local.',
      solicitado ? 'info' : 'erro');
  }

  async function testarEnvioRemoto() {
    if (enviandoTeste) return;
    setEnviandoTeste(true);
    try {
      const resultado = await api.post('/push/testar');
      const aceitos = Number(resultado.aceitosGateway ?? 0);
      const inscritos = Number(resultado.inscritos ?? 0);
      avisar(
        'Push remoto de SIMULAÇÃO: ' + aceitos + ' de ' + inscritos +
        ' dispositivos inscritos tiveram envio aceito pelo serviço de notificações. ' +
        'Confira os celulares; aceite do serviço não confirma exibição na tela.',
        aceitos > 0 ? 'sucesso' : 'erro'
      );
    } catch (err) {
      avisar('Não foi possível testar o envio remoto: ' + err.message, 'erro');
    } finally {
      setEnviandoTeste(false);
    }
  }

  return <span className="inline-flex items-center gap-1 flex-wrap"><button
    type="button"
    className={`hs-alerts-icon ${ativo ? 'enabled' : ''}`}
    onClick={configurar}
    disabled={ocupado}
    title={ativo
      ? 'Inscrição de Web Push para alertas de simulação, inclusive no modo Dados reais. Toque para desativar.'
      : 'Ativar avisos simulados por Web Push, mesmo ao visualizar dados reais'}
    aria-label={ativo
      ? 'Avisos automáticos de teste ativados; toque para desativar'
      : 'Ativar avisos automáticos experimentais neste celular'}
    aria-pressed={ativo}
  >
    <span aria-hidden="true">{ativo ? '🔔' : '🔕'}</span>
    <span className="hs-alerts-icon-text">{pushAtivo ? 'Push ativo' : ativo ? 'Permissão concedida' : 'Ativar avisos'}</span>
  </button>{ativo && pushErro && <span className="text-xs text-amber-400" role="status">Push remoto não ativo: {pushErro}</span>}{ativo && <button type="button" className="hs-alerts-icon" onClick={testarAvisoLocal} title="Exibir apenas um aviso local neste dispositivo" aria-label="Testar aviso local">Testar local</button>}
  {pushAtivo && <button type="button" className="hs-alerts-icon" onClick={testarEnvioRemoto} disabled={enviandoTeste} title="Enviar aviso remoto de SIMULAÇÃO a todos os celulares inscritos; requer chave de operador" aria-label="Testar envio remoto aos celulares">{enviandoTeste ? 'Enviando…' : 'Testar nos celulares'}</button>}</span>;
}
