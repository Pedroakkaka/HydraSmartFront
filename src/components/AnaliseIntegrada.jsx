import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

/**
 * A IA é um complemento interpretativo do histórico; nunca define risco.
 * Sem registros reais ou sem backend configurado, não apresenta previsões.
 */
/**
 * Renderização limitada do Markdown retornado pela IA: títulos, parágrafos e negrito.
 * Não interpreta HTML nem insere conteúdo da IA diretamente no DOM.
 */
function textoFormatado(texto) {
  return texto.split(/(\\*\\*[^*\\n]+\\*\\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**')
      ? <strong key={i} className="font-semibold text-white">{parte.slice(2, -2)}</strong>
      : parte
  );
}

function RelatorioFormatado({ texto }) {
  const linhas = texto.replace(/\\r\\n?/g, '\\n').split('\\n');
  const blocos = [];
  let paragrafo = [];
  const fecharParagrafo = () => {
    if (paragrafo.length) {
      blocos.push({ tipo: 'paragrafo', texto: paragrafo.join(' ') });
      paragrafo = [];
    }
  };
  for (const linha of linhas) {
    const atual = linha.trim();
    if (!atual) { fecharParagrafo(); continue; }
    const tituloMarkdown = atual.match(/^#{1,4}\\s+(.+)$/);
    const tituloNegrito = atual.match(/^\\*\\*([^*]+)\\*\\*:?$/);
    if (tituloMarkdown || tituloNegrito) {
      fecharParagrafo();
      blocos.push({ tipo: 'titulo', texto: (tituloMarkdown ? tituloMarkdown[1] : tituloNegrito[1]).trim() });
    } else {
      paragrafo.push(atual);
    }
  }
  fecharParagrafo();
  return (
    <div className="space-y-3 text-sm text-slate-200 leading-relaxed">
      {blocos.map((bloco, i) => bloco.tipo === 'titulo'
        ? <h4 key={i} className="font-bold text-white text-base pt-2">{bloco.texto}</h4>
        : <p key={i}>{textoFormatado(bloco.texto)}</p>)}
    </div>
  );
}

export default function AnaliseIntegrada() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['analise-historica-cloudflare'],
    queryFn: () => api.get('/ia/relatorio'),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });
  return (
    <section className="card-base mb-6" aria-label="Análise histórica integrada">
      <div className="card-header-line">
        <div>
          <h3 className="text-sm font-bold text-white">🧠 Análise contextual do histórico</h3>
          <p className="text-xs text-slate-400 mt-1">A Cloudflare Workers AI interpreta dados oficiais da Defesa Civil RS, histórico meteorológico e leituras disponíveis. O relatório é público e atualizado sob demanda, com cache compartilhado de 5 minutos. A IA não define alertas nem altera parâmetros.</p>
        </div>
        <button type="button" className="btn-action-secondary text-xs" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? 'Analisando...' : 'Atualizar análise'}
        </button>
      </div>
      {isLoading ? <p className="text-xs text-slate-400 mt-3">Consultando registros históricos...</p> : null}
      {isError ? <p role="status" className="text-xs text-amber-400 mt-3">Análise indisponível: {error?.status === 404 ? 'a API em execução ainda não possui a nova rota. Atualize e reinicie o backend.' : error?.message || 'verifique a API e a configuração da Cloudflare Workers AI.'} O monitoramento do Core permanece independente.</p> : null}
      {data?.status === 'erro' || data?.status === 'indisponivel' || data?.status === 'processando' || data?.status === 'aguardando' ? <p className="text-xs text-amber-400 mt-3">{data.mensagem}</p> : null}
      {data?.status === 'sem_dados' ? <p className="text-xs text-slate-400 mt-3">{data.mensagem || 'Ainda não há leituras históricas suficientes para gerar o relatório.'}</p> : null}
      {(data?.analise || data?.relatorio) ? (
        <div className="mt-3">
          <RelatorioFormatado texto={typeof (data.analise || data.relatorio) === 'string' ? (data.analise || data.relatorio) : JSON.stringify(data.analise || data.relatorio, null, 2)} />
          {data.desatualizado ? <p role="status" className="text-xs text-amber-400 mt-2">Último relatório válido: a atualização mais recente falhou. {data.avisoAtualizacao || ''}</p> : null}
          <p className="text-xs text-slate-400 mt-3">{data.registrosConsultados} registros consultados • Gerado em {data.geradoEm ? new Date(data.geradoEm).toLocaleString('pt-BR') : 'horário indisponível'} • Interpretação consultiva, não previsão validada.</p>
          {data.fontes?.length ? <p className="text-xs text-slate-400 mt-2">Fontes: {data.fontes.map((f) => `${f.fonte} (${f.tipo}${f.estacao ? `, ${f.estacao}` : ''}: ${f.registros} registros)`).join('; ')}.</p> : null}
          {data.aviso ? <p className="text-xs text-slate-400 mt-2">{data.aviso}</p> : null}
          {data.avisosFontes?.length ? <p className="text-xs text-amber-400 mt-2">Algumas fontes não responderam: {data.avisosFontes.join('; ')}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
