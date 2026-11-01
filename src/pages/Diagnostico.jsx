import { useQuery } from '@tanstack/react-query';
import { useTelemetria } from '../store/useTelemetria.js';
import { useClima } from '../hooks/useConsultas.js';
import { api } from '../lib/api.js';
import { metaRisco, temLeitura } from '../lib/risco.js';
import { dataHora, num } from '../lib/formato.js';

function Indicador({ titulo, valor, detalhe, destaque = false }) {
  return (
    <article className="diag-card" style={{ minHeight: 145 }}>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{titulo}</div>
      <div className={`text-2xl font-extrabold mt-3 ${destaque ? 'text-cyan-300' : 'text-white'}`}>{valor}</div>
      <p className="text-xs text-slate-400 mt-2">{detalhe}</p>
    </article>
  );
}

export default function Diagnostico() {
  const estado = useTelemetria((s) => s.estado);
  const { data: clima } = useClima();
  const relatorio = useQuery({
    queryKey: ['relatorio-automatico-ia'],
    queryFn: () => api.get('/ia/relatorio'),
    refetchInterval: 5 * 60_000,
    retry: false
  });

  const bueiros = Object.entries(estado?.bueiros ?? {});
  const validos = bueiros.filter(([, b]) => temLeitura(b) && !b.desatualizado);
  const maiorNivel = validos.length ? Math.max(...validos.map(([, b]) => Number(b.nivelPct) || 0)) : null;
  const maiorRisco = validos.some(([, b]) => b.risco === 'critico')
    ? 'critico' : validos.some(([, b]) => b.risco === 'atencao') ? 'atencao' : validos.length ? 'normal' : 'desconhecido';
  const risco = metaRisco(maiorRisco);
  const simulacao = estado?.modo === 'prototipo' || estado?.modo === 'simulacao' || validos.some(([, b]) => b.origem === 'simulador');


  return (
    <div className="space-y-5">
      <header className="diag-card">
        <div className="text-xs font-bold tracking-widest text-cyan-400">HYDRASMART • DIAGNÓSTICO INTELIGENTE</div>
        <h1 className="text-2xl font-extrabold text-white mt-2">Análise do comportamento da água</h1>
        <p className="text-sm text-slate-300 mt-2">
          Indicadores medidos pelo sistema e interpretações complementares da IA, apresentados separadamente para evitar previsões sem validação.
        </p>
        <span className={`badge-pill mt-3 ${simulacao ? 'warning' : 'normal'}`}>
          {simulacao ? 'Dados de simulação / protótipo' : 'Modo de monitoramento'}
        </span>
      </header>

      <section aria-label="Indicadores essenciais">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white">Indicadores essenciais</h2>
          <span className="text-xs text-slate-400">Atualizados pela telemetria</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Indicador titulo="Nível atual máximo" valor={maiorNivel == null ? 'Sem leitura' : `${num(maiorNivel)}%`}
            detalhe="Maior nível entre os pontos com leitura válida e atual." destaque />
          <Indicador titulo="Situação de risco" valor={validos.length ? risco.rotulo : 'Indeterminada'}
            detalhe="Classificação calculada pelo sistema, não pela IA." />
          <Indicador titulo="Tempo até enchimento" valor="Não estimado"
            detalhe="Requer histórico temporal, tendência e modelo hidráulico validado." />
          <Indicador titulo="Chance de alagamento" valor="Não calculada"
            detalhe="Probabilidade só será exibida após validação de modelo preditivo." />
        </div>
      </section>

      <section className="diag-card" aria-label="Leituras por ponto">
        <h2 className="text-base font-bold text-white mb-3">Níveis monitorados</h2>
        {bueiros.length === 0 ? <p className="text-sm text-slate-400">Aguardando telemetria dos sensores.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {bueiros.map(([id, b]) => {
              const atual = temLeitura(b) && !b.desatualizado;
              return <div key={id} className="rounded-xl border border-slate-700 p-4 bg-slate-950/50">
                <div className="flex justify-between gap-2 items-center">
                  <strong className="text-sm text-white">{id.replaceAll('_', ' ').toUpperCase()}</strong>
                  <span className={`badge-pill ${atual ? metaRisco(b.risco).classe : 'muted'}`}>
                    {atual ? metaRisco(b.risco).rotulo : 'Sem leitura atual'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-cyan-300 mt-2">{atual ? `${num(b.nivelPct)}%` : '--'}</div>
                <p className="text-xs text-slate-400 mt-1">
                  {atual ? `${num(b.alturaAguaCm)} cm de água • ${dataHora(b.timestamp)}` : 'Aguardando medição válida e recente'}
                </p>
              </div>;
            })}
          </div>
        )}
      </section>

      <section className="diag-card">
        <h2 className="text-sm font-bold text-white">Contexto meteorológico</h2>
        <p className="text-sm text-slate-300 mt-2">
          Precipitação observada: {clima?.precipitacaoObservadaMm == null ? 'indisponível' : `${num(clima.precipitacaoObservadaMm, 1)} mm`}.
          Esta informação é complementar e não equivale, isoladamente, à probabilidade de alagamento.
        </p>
      </section>
      <section className="diag-card" aria-label="Relatório automático da inteligência artificial">
        <div>
          <h2 className="text-base font-bold text-white">🧠 Relatório inteligente da IA</h2>
          <p className="text-xs text-slate-400 mt-1">Interpretação escrita automaticamente a partir das leituras históricas disponíveis.</p>
        </div>
        {relatorio.data?.status === 'disponivel' ? (
          <div className="mt-4 rounded-xl border border-cyan-900 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{relatorio.data.analise}</p>
            <p className="text-xs text-slate-400 mt-4">
              {relatorio.data.registrosConsultados} leituras consultadas • Gerado em {dataHora(relatorio.data.geradoEm)}
            </p>
            <p className="text-xs text-amber-300 mt-2">{relatorio.data.aviso}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 mt-4" role="status">
            {relatorio.isError ? 'Relatório indisponível: verifique a conexão com a API.' :
              relatorio.data?.mensagem || 'Consultando análise histórica...'}
          </p>
        )}
      </section>

    </div>
  );
}
