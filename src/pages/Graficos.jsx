import { useState } from 'react';
import AnaliseIntegrada from '../components/AnaliseIntegrada.jsx';
import HidrologiaOficial from '../components/HidrologiaOficial.jsx';
import { Line } from 'react-chartjs-2';
import { useQuery } from '@tanstack/react-query';
import { useTelemetria } from '../store/useTelemetria.js';
import { useAlertas, useHistoricoOficial } from '../hooks/useConsultas.js';
import { api, urlDownload } from '../lib/api.js';
import { eixoPercentual, linhaLimiar, opcoesBase, serieBueiro1, serieBueiro2 } from '../lib/graficos.js';
import { dataHora, hora, horaCurta, num } from '../lib/formato.js';

const opcoesNivel = {
  ...opcoesBase,
  animation: { duration: 250 },
  plugins: {
    ...opcoesBase.plugins,
    tooltip: { ...opcoesBase.plugins.tooltip, callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y === null ? 'N/A' : `${c.parsed.y.toFixed(1)}%`}` } }
  },
  scales: { ...opcoesBase.scales, y: eixoPercentual }
};

const PERIODOS = [
  { id: '1h', rotulo: '1 hora', ms: 3600e3, intervalo: 30 },
  { id: '6h', rotulo: '6 horas', ms: 6 * 3600e3, intervalo: 120 },
  { id: '24h', rotulo: '24 horas', ms: 24 * 3600e3, intervalo: 600 }
];

function GraficoAoVivo({ b1, b2 }) {
  // As duas réguas têm relógios e frequências independentes; índices de arrays
  // não representam a mesma hora. Unimos timestamps e criamos lacunas explícitas.
  const tempos = [...new Set([...b1.historicoTimestamps, ...b2.historicoTimestamps].filter(Number.isFinite))].sort((a,b)=>a-b);
  const labels = tempos.map(t => new Date(t).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit',second:'2-digit'}));
  const mapear = b => {
    const mapa = new Map(b.historicoTimestamps.map((t,i)=>[t,b.historicoNiveis[i]]));
    return tempos.map(t => mapa.has(t) ? mapa.get(t) : null);
  };
  const n = Math.max(labels.length, 1);

  const dados = {
    labels: labels.length ? labels : ['Aguardando leituras'],
    datasets: [
      { label: 'Bueiro 01 — Entrada (%)', data: mapear(b1), fill: true, spanGaps: true, tension: 0.25, borderWidth: 2.2, pointRadius: 2, ...serieBueiro1 },
      ...(b2.historicoNiveis.length ? [{ label: 'Bueiro 02 — Saída (%)', data: mapear(b2), fill: true, spanGaps: true, tension: 0.25, borderWidth: 2.2, pointRadius: 2, ...serieBueiro2 }] : []),
      linhaLimiar(`Atenção (${b1.calibracao.limiteAtencaoPct}%)`, b1.calibracao.limiteAtencaoPct, 'rgba(251, 191, 36, 0.5)', n),
      linhaLimiar(`Crítico (${b1.calibracao.limiteCriticoPct}%)`, b1.calibracao.limiteCriticoPct, 'rgba(244, 63, 94, 0.65)', n)
    ]
  };
  return <Line data={dados} options={opcoesNivel} />;
}

function GraficoBanco() {
  const [periodo, setPeriodo] = useState(PERIODOS[0]);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['serie', periodo.id],
    queryFn: () => {
      const desde = new Date(Date.now() - periodo.ms).toISOString();
      return api.get(`/leituras/serie?desde=${encodeURIComponent(desde)}&intervaloSegundos=${periodo.intervalo}`);
    },
    refetchInterval: 30_000
  });

  const pontos = data ?? [];
  const instantes = [...new Set(pontos.map((p) => p.inicio))].sort();
  const serie = (id) => {
    const mapa = new Map(pontos.filter((p) => p.bueiroId === id).map((p) => [p.inicio, p.nivelMedioPct]));
    return instantes.map((t) => mapa.get(t) ?? null);
  };

  const dados = {
    labels: instantes.map((t) => horaCurta(t)),
    datasets: [
      { label: 'Bueiro 01 — média (%)', data: serie('bueiro_1'), tension: 0.25, borderWidth: 2, pointRadius: 0, spanGaps: false, ...serieBueiro1 },
      { label: 'Bueiro 02 — média (%)', data: serie('bueiro_2'), tension: 0.25, borderWidth: 2, pointRadius: 0, spanGaps: false, ...serieBueiro2 }
    ]
  };

  return (
    <div className="card-base mb-6">
      <div className="card-header-line">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><span>🗄️</span> Histórico Gravado no Banco de Dados</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Somente leituras de sensores de campo (exclui ensaios de bancada). Média a cada {periodo.intervalo >= 60 ? `${periodo.intervalo / 60} min` : `${periodo.intervalo} s`}.
          </p>
        </div>
        <div className="seletor-periodo">
          {PERIODOS.map((p) => (
            <button key={p.id} className={`${p.id === periodo.id ? 'btn-action-primary' : 'btn-action-secondary'} text-xs`} onClick={() => setPeriodo(p)}>
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64 w-full relative mt-2">
        {isError ? <div className="text-rose-400 text-xs py-4">Não foi possível consultar o histórico.</div>
          : !isLoading && !instantes.length ? <div className="text-slate-500 text-xs py-4">Nenhuma leitura real registrada neste período.</div>
            : <Line data={dados} options={opcoesNivel} />}
      </div>
    </div>
  );
}

export default function Graficos() {
  const { bueiro_1: b1, bueiro_2: b2 } = useTelemetria((s) => s.estado.bueiros);
  const fonte = useTelemetria((s) => s.fonteSelecionada);
  const bueiros = useTelemetria((s) => s.estado?.bueiros || {});
  const { data: historico } = useHistoricoOficial();
  const { data: alertas } = useAlertas();
  const canalLocal = useTelemetria((s) => s.canalLocal);
  const localB1 = canalLocal.bueiro_1;
  const localB2 = canalLocal.bueiro_2;
  const totalAoVivo = b1.historicoNiveis.length + b2.historicoNiveis.length;

  return (
    <>
      <div className="card-base mb-6">
        <div className="card-header-line">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><span>📈</span> Séries Temporais ao Vivo</h3>
            <p className="text-xs text-slate-400 mt-0.5">Leituras recebidas da fonte selecionada. Dados experimentais e fictícios não são medições de campo.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">{totalAoVivo} amostras</span>
            {fonte === 'inteligente' && <a className="btn-action-secondary text-xs" href={urlDownload('/relatorios/leituras.csv')} download>📥 Exportar CSV (24h)</a>}
            {fonte === 'inteligente' && <a className="btn-action-secondary text-xs" href={urlDownload('/relatorios/auditoria.json')} download>📄 Auditoria JSON</a>}
          </div>
        </div>
        {fonte === 'prototipo' && <p className="text-xs text-slate-300 mt-2" role="status">
          <strong>B01:</strong> {localB1?.timestamp ? `${Number(localB1.nivelPct).toLocaleString('pt-BR')}% · ${localB1.historicoNiveis.length} leituras` : 'Aguardando leitura'}
          {' · '}<strong>B02:</strong> {localB2?.timestamp ? `${Number(localB2.nivelPct).toLocaleString('pt-BR')}% · ${localB2.historicoNiveis.length} leituras` : 'Aguardando segunda régua'}.
          {' '}A curva atualiza quando cada novo nível é recebido; nenhuma chave de API é necessária para visualizar neste computador.
        </p>}
        <div className="h-72 w-full relative mt-2">
          <GraficoAoVivo b1={b1} b2={b2} />
        </div>
      </div>

      {fonte === 'inteligente' && <GraficoBanco />}

      {fonte === 'inteligente' && <HidrologiaOficial />}

      <AnaliseIntegrada demonstracao={fonte === 'prototipo'} bueiros={bueiros} />

      {fonte === 'inteligente' && <div className="card-base mb-6">
        <div className="card-header-line">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><span>🚨</span> Alertas Críticos Registrados</h3>
          <span className="text-[11px] text-slate-400">Somente eventos reais</span>
        </div>
        {alertas?.length ? (
          <table className="tabela-alertas">
            <thead>
              <tr><th>Início</th><th>Bueiro</th><th>Pico</th><th>Encerrado</th><th>Reconhecido</th></tr>
            </thead>
            <tbody>
              {alertas.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono">{dataHora(a.iniciadoEm)}</td>
                  <td>{a.bueiroId === 'bueiro_1' ? 'Bueiro 01' : 'Bueiro 02'}</td>
                  <td className="font-mono text-rose-400">{num(a.nivelPctPico)}%</td>
                  <td className="font-mono">{a.encerradoEm ? dataHora(a.encerradoEm) : <span className="text-rose-400">em andamento</span>}</td>
                  <td className="font-mono">{a.reconhecidoEm ? dataHora(a.reconhecidoEm) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="text-slate-500 text-xs py-2">Nenhum alerta crítico real registrado.</div>}
      </div>}

      {fonte === 'inteligente' && <div className="card-base">
        <div className="card-header-line">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><span>📜</span> Registros e referências oficiais de Porto Alegre-RS</h3>
            <p className="text-xs text-slate-400 mt-0.5">Fontes oficiais de Porto Alegre; registros históricos não equivalem a leituras em tempo real dos sensores.</p>
          </div>
        </div>
        <div className="grid-2-md mt-3">
          {(historico ?? []).map((r) => (
            <div key={r.id} className="history-card">
              <div className="history-card-header">
                <span className="history-badge">{r.id}</span>
                <span className="text-xs text-slate-400 font-mono">{r.data}</span>
              </div>
              <div className="history-title">{r.titulo}</div>
              <div className="text-xs text-amber-400 font-mono">{r.tipoOcorrencia}</div>
              <p className="history-desc">{r.descricaoOficial}</p>
              <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 space-y-1">
                <div><b>Órgão:</b> {r.orgaoResponsavel}</div>
                <div><b>Fonte Documental:</b> {r.fonteDocumental}</div>
              </div>
              <a href={r.linkConsulta} target="_blank" rel="noreferrer" className="history-link">Acessar Registro Oficial Externo ↗</a>
            </div>
          ))}
        </div>
      </div>}
    </>
  );
}
