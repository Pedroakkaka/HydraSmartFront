import { useTelemetria } from '../store/useTelemetria.js';

/** Faixas de aviso no topo: modo demonstração, alerta crítico e servidor fora do ar. */
export default function Banners() {
  const estado = useTelemetria((s) => s.estado);
  const conexao = useTelemetria((s) => s.conexao);
  const dispensados = useTelemetria((s) => s.alertasDispensados);
  const dispensar = useTelemetria((s) => s.dispensarAlertas);
  const fonte = useTelemetria((s) => s.fonteSelecionada);

  const alertas = (estado?.alertasAtivos ?? []).filter((a) => !dispensados.includes(a.id));

  return (
    <>
      {conexao === 'offline' && (
        <div className="critical-emergency-banner">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span>
              <b>SEM CONEXÃO COM O SERVIDOR:</b> os dados exibidos podem estar desatualizados. Tentando reconectar...
            </span>
          </div>
        </div>
      )}

      {fonte === 'prototipo' && (
        <div className="demo-alert-banner" role="status">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400"/>
            <span><b>{'MODO PROTÓTIPO EXPERIMENTAL:'}</b> {'Leituras do projeto físico. Não são medições de campo.'}</span>
          </div>
        </div>
      )}

      {alertas.length > 0 && (
        <div className="critical-emergency-banner">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span>
              ALERTA CRÍTICO{alertas[0].simulado ? ' (SIMULADO)' : ''}: {alertas[0].mensagem}
              {alertas.length > 1 ? ` (+${alertas.length - 1})` : ''}
            </span>
          </div>
          <button className="btn-action-secondary text-xs" onClick={() => dispensar(alertas.map((a) => a.id))}>
            Dispensar
          </button>
        </div>
      )}
    </>
  );
}
