import { useState } from 'react';
import { useNotificacoesTeste } from '../lib/notificacoesTeste.js';
import { inscreverCelular } from '../lib/pushRemoto.js';

/**
 * Aparece na entrada do site: a pessoa não precisa procurar o sino.
 * Navegadores móveis exigem toque para exibir o prompt nativo do sistema.
 * Não tenta contornar bloqueios ou repetir solicitações recusadas.
 */
export default function SolicitacaoInicialAlertas() {
  const inscrito = useNotificacoesTeste(s => s.inscrito);
  const definirInscricao = useNotificacoesTeste(s => s.definirInscricao);
  const definirPush = useNotificacoesTeste(s => s.definirPush);
  const [erro, setErro] = useState('');
  const [descartado, setDescartado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const suportado = typeof window !== 'undefined' && window.isSecureContext &&
    'Notification' in window;
  // Não insistir com quem já recusou ou desativou notificações.
  const pendente = suportado && Notification.permission !== 'denied' &&
    !inscrito && !descartado;

  if (!pendente) return null;

  const solicitar = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      // Executado diretamente pelo clique do visitante: requisito de Chrome,
      // Safari e de vários navegadores móveis.
      const permissao = Notification.permission === 'granted'
        ? 'granted' : await Notification.requestPermission();
      if (permissao === 'granted') {
        definirInscricao(true);
        try {
          await inscreverCelular();
          definirPush(true);
          setDescartado(true);
        } catch (err) {
          definirPush(false, err.message);
          setErro(err.message);
        }
      } else {
        setDescartado(true);
      }
    } catch (err) {
      setErro(err.message || 'Não foi possível ativar os avisos.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <aside role="region" aria-label="Permissão de avisos do HydraSmart"
      className="fixed z-[9999] inset-x-3 bottom-3 mx-auto max-w-xl rounded-xl border border-cyan-500/40 bg-slate-950 p-4 shadow-2xl sm:bottom-6"
      style={{ boxShadow: '0 12px 40px rgba(0,0,0,.45)' }}>
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">🔔</span>
        <div className="flex-1 min-w-0">
          <strong className="block text-sm text-white">Receber alertas de teste do HydraSmart?</strong>
          <p className="mt-1 text-xs text-slate-300">
            Autorize neste celular avisos de simulação do projeto físico, mesmo ao
            visualizar dados reais. Os avisos são testes e NÃO são emergências reais.
            A inscrição remota permite avisos mesmo com o site fechado em aparelhos
            compatíveis, quando o servidor estiver configurado.
          </p>
          {erro && <p role="alert" className="mt-2 text-xs text-amber-300">{erro}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={solicitar} disabled={ocupado}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-60">
              {ocupado ? 'Solicitando…' : 'Permitir notificações'}
            </button>
            <button type="button" onClick={() => setDescartado(true)}
              className="rounded-lg border border-slate-600 px-4 py-2 text-xs text-slate-200">
              Agora não
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
