import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const CODIGOS = ['DCRS-00044', 'DCRS-00054', 'DCRS-00076', 'DCRS-00105'];
const rotulos = {
  'DCRS-00044': 'Viamão – Itapuã',
  'DCRS-00054': 'Barra do Ribeiro – Lago Guaíba',
  'DCRS-00076': 'Eldorado do Sul',
  'DCRS-00105': 'Viamão – Reserva Estadual'
};
const valor = (v, unidade) => v === null || v === undefined || v === '' || !Number.isFinite(Number(v))
  ? 'Sem leitura' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unidade}`;
const horario = (v) => {
  if (!v) return 'Não informado';
  const d = new Date(v.endsWith('Z') || /[+-]\d\d:\d\d$/.test(v) ? v : v + 'Z');
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

export default function HidrologiaOficial() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['hidrologia-estacoes-rs'],
    queryFn: () => api.get('/hidrologia/estacoes'),
    refetchInterval: 5 * 60 * 1000,
    retry: 1
  });
  const estacoes = (data?.estacoes ?? []).filter((e) => CODIGOS.includes(e.codigo))
    .sort((a, b) => CODIGOS.indexOf(a.codigo) - CODIGOS.indexOf(b.codigo));
  return (
    <section className="card-base mb-6" aria-label="Monitoramento hidrológico oficial">
      <div className="card-header-line">
        <div>
          <h3 className="text-sm font-bold text-white">🌊 Monitoramento Hidrológico — Porto Alegre e Região</h3>
          <p className="text-xs text-slate-400 mt-1">Medições regionais da Defesa Civil RS. Não representam o enchimento dos bueiros nem substituem alertas oficiais.</p>
        </div>
        <button type="button" className="btn-action-secondary text-xs" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? 'Atualizando...' : 'Atualizar dados'}
        </button>
      </div>
      {isLoading && <p className="text-xs text-slate-400 mt-3">Consultando estações oficiais...</p>}
      {isError && <p role="status" className="text-xs text-amber-400 mt-3">Não foi possível consultar a Defesa Civil RS. Confira a conexão com o backend.</p>}
      {!isLoading && !isError && estacoes.length === 0 && <p className="text-xs text-slate-400 mt-3">Nenhuma estação selecionada retornou dados.</p>}
      <div className="grid-2-md mt-3">
        {estacoes.map((e) => {
          const dataLeitura = e.horarioLeitura ? new Date(e.horarioLeitura.endsWith('Z') ? e.horarioLeitura : e.horarioLeitura + 'Z') : null;
          const antiga = dataLeitura && !Number.isNaN(dataLeitura.getTime()) && Date.now() - dataLeitura.getTime() > 30 * 60 * 1000;
          return (
            <article key={e.codigo} className="history-card">
              <div className="history-card-header">
                <span className="history-badge">{e.codigo}</span>
                <span className="text-xs text-slate-400">{antiga ? '⚠ Leitura antiga' : 'Estação oficial'}</span>
              </div>
              <div className="history-title">{rotulos[e.codigo]}</div>
              <div className="text-sm text-slate-200 mt-2">Nível informado: <strong>{valor(e.rio?.nivelMetros, 'm')}</strong></div>
              <div className="text-xs text-slate-400 mt-1">Tendência: {valor(e.rio?.tendenciaMetros, 'm')}</div>
              <div className="text-xs text-slate-400 mt-1">Chuva 1h: {valor(e.chuva?.acumulado1hMm, 'mm')} · 24h: {valor(e.chuva?.acumulado24hMm, 'mm')}</div>
              <div className="text-xs text-slate-400 mt-1">Situação oficial: {e.rio?.situacaoOficial || 'Não informada'}</div>
              <div className="text-xs text-slate-400 mt-1">Leitura: {horario(e.horarioLeitura)} (Brasília)</div>
              <div className="text-xs text-slate-400 mt-1">Homologação do nível: {e.rio?.homologado === true ? 'Sim' : e.rio?.homologado === false ? 'Não' : 'Não informada'}</div>
            </article>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 mt-3">Fonte: <a href="https://sistemas.defesacivil.rs.gov.br/api-redehidrometeorologica" target="_blank" rel="noreferrer" className="history-link">Defesa Civil do Rio Grande do Sul ↗</a>. Atualização automática a cada 5 minutos; os horários refletem as leituras fornecidas, não a hora de abertura da página.</p>
    </section>
  );
}
