import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

/**
 * A IA é um complemento interpretativo do histórico; nunca define risco.
 * Sem registros reais ou sem backend configurado, não apresenta previsões.
 */
export default function AnaliseIntegrada() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['analise-historica-gemini'],
    queryFn: () => api.post('/ia/analisar', {
      pergunta: 'Analise as tendências das leituras históricas e possíveis sinais de agravamento. Explique limitações. Não calcule probabilidades ou declare previsão de alagamento sem modelo quantitativo validado pelo Core.',
      limite: 60
    }),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });
  return (
    <section className="card-base mb-6" aria-label="Análise histórica integrada">
      <div className="card-header-line">
        <div>
          <h3 className="text-sm font-bold text-white">🧠 Análise contextual do histórico</h3>
          <p className="text-xs text-slate-400 mt-1">Gemini interpreta leituras do Core. Cálculos, classificação de risco e alertas continuam exclusivamente no Core.</p>
        </div>
        <button type="button" className="btn-action-secondary text-xs" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? 'Analisando...' : 'Atualizar análise'}
        </button>
      </div>
      {isLoading ? <p className="text-xs text-slate-400 mt-3">Consultando registros históricos...</p> : null}
      {isError ? <p role="status" className="text-xs text-amber-400 mt-3">Análise indisponível: {error?.status === 404 ? 'a API em execução ainda não possui a nova rota. Atualize e reinicie o backend.' : error?.message || 'verifique a API e a configuração do Gemini.'} O monitoramento do Core permanece independente.</p> : null}
      {data?.analise ? (
        <div className="mt-3">
          <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{data.analise}</p>
          <p className="text-xs text-slate-400 mt-3">{data.registrosConsultados} leituras consultadas • Interpretação de IA, não previsão numérica validada ou alerta oficial.</p>
        </div>
      ) : null}
    </section>
  );
}
