import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

/**
 * A IA é um complemento interpretativo do histórico; nunca define risco.
 * Sem registros reais ou sem backend configurado, não apresenta previsões.
 */
export default function AnaliseIntegrada() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['analise-historica-openai'],
    queryFn: () => api.get('/ia/relatorio'),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });
  return (
    <section className="card-base mb-6" aria-label="Análise histórica integrada">
      <div className="card-header-line">
        <div>
          <h3 className="text-sm font-bold text-white">🧠 Análise contextual do histórico</h3>
          <p className="text-xs text-slate-400 mt-1">A análise utiliza OpenAI quando há leituras históricas suficientes. Alertas e classificações de risco não são definidos pela IA.</p>
        </div>
        <button type="button" className="btn-action-secondary text-xs" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? 'Analisando...' : 'Atualizar análise'}
        </button>
      </div>
      {isLoading ? <p className="text-xs text-slate-400 mt-3">Consultando registros históricos...</p> : null}
      {isError ? <p role="status" className="text-xs text-amber-400 mt-3">Análise indisponível: {error?.status === 404 ? 'a API em execução ainda não possui a nova rota. Atualize e reinicie o backend.' : error?.message || 'verifique a API e a configuração da OpenAI.'} O monitoramento do Core permanece independente.</p> : null}
      {data?.status === 'sem_dados' ? <p className="text-xs text-slate-400 mt-3">{data.mensagem || 'Ainda não há leituras históricas suficientes para gerar o relatório.'}</p> : null}
      {(data?.analise || data?.relatorio) ? (
        <div className="mt-3">
          <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{typeof (data.analise || data.relatorio) === 'string' ? (data.analise || data.relatorio) : JSON.stringify(data.analise || data.relatorio, null, 2)}</p>
          <p className="text-xs text-slate-400 mt-3">{data.registrosConsultados} leituras consultadas • Interpretação de IA, não previsão numérica validada ou alerta oficial.</p>
        </div>
      ) : null}
    </section>
  );
}
