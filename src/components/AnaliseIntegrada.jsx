import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

// Mostra apenas informações efetivamente contidas no relatório; a IA não define risco ou previsão.
function extrairResumo(texto) {
  if (!texto) return { resumo: '', achados: [], secoes: [] };
  const secoes = [];
  let atual = { titulo: 'Relatório', linhas: [] };
  for (const linha of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const limpa = linha.trim();
    if (!limpa) continue;
    const cabecalho = limpa.match(/^(?:#{1,4}\s+|\*\*)([^*\n]+?)(?:\*\*)?:?$/);
    if (cabecalho && (limpa.startsWith('**') || limpa.startsWith('#'))) {
      if (atual.linhas.length) secoes.push(atual);
      atual = { titulo: cabecalho[1].trim(), linhas: [] };
    } else {
      atual.linhas.push(limpa.replace(/^[-*•]\s+/, '').replace(/\*\*/g, ''));
    }
  }
  if (atual.linhas.length) secoes.push(atual);
  const resumoSecao = secoes.find((s) => /resumo|conclus[aã]o/i.test(s.titulo));
  const resumo = (resumoSecao?.linhas.join(' ') || secoes[0]?.linhas.join(' ') || '').slice(0, 350);
  const tendencias = secoes.find((s) => /tend[eê]ncias|limita[cç][oõ]es/i.test(s.titulo));
  const observacoes = secoes.find((s) => /observa[cç][oõ]es atuais/i.test(s.titulo));
  const achados = [...(observacoes?.linhas || []), ...(tendencias?.linhas || [])].slice(0, 3);
  return { resumo, achados, secoes };
}

export default function AnaliseIntegrada({ estacao, chuva }) {
  const [expandido, setExpandido] = useState(false);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['analise-historica-cloudflare'],
    queryFn: () => api.get('/ia/relatorio'),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });
  const texto = typeof (data?.analise || data?.relatorio) === 'string' ? (data.analise || data.relatorio) : '';
  const { resumo, achados, secoes } = extrairResumo(texto);
  
  const fontes = [...new Set((data?.fontes || []).map((f) => f.fonte).filter(Boolean))];
  const nivel = estacao?.rio?.nivelMetros;
  const tendencia = estacao?.rio?.tendenciaMetros;
  const formatar = (v, unidade = '') => v == null || !Number.isFinite(Number(v)) ? '—' : `${Number(v).toLocaleString('pt-BR', {maximumFractionDigits: 2})}${unidade}`;

  return (
    <section className="hydra-panel hydra-ai" aria-label="Análise contextual do histórico">
      <header className="hydra-ai-header">
        <h2>▱ Análise contextual do histórico</h2>
        <span>{data?.geradoEm ? new Date(data.geradoEm).toLocaleString('pt-BR') : 'Atualização automática'}</span>
      </header>
      <div className="hydra-ai-body">
        <div className="hydra-ai-summary">
          <strong>✦ Resumo da IA</strong>
          <p>{isLoading ? 'Consultando as fontes oficiais…' : isError ? 'Não foi possível obter a análise neste momento.' : resumo || data?.mensagem || 'Sem relatório disponível.'}</p>
        </div>
        <div className="hydra-insights">
          <div className="hydra-insight"><span className="hs-insight-icon">♧</span><span>Nível oficial</span><strong>{formatar(nivel, ' m')}</strong><small>{estacao?.codigo ?? 'Sem estação'}</small></div>
          <div className="hydra-insight"><span className="hs-insight-icon">↗</span><span>Tendência oficial</span><strong>{formatar(tendencia, ' m')}</strong><small>Valor informado pela estação</small></div>
          <div className="hydra-insight"><span className="hs-insight-icon">☁</span><span>Precipitação</span><strong>{formatar(chuva, ' mm')}</strong><small>Open-Meteo</small></div>
          <div className="hydra-insight"><span className="hs-insight-icon">◷</span><span>Janela crítica</span><strong>—</strong><small>Não calculada</small></div>
        </div>
        <div className="hydra-ai-section">
          <h3>◎ Principais achados</h3>
          {achados.length ? <ul className="hydra-findings">{achados.map((item, index) => <li key={index}>{item}</li>)}</ul>
            : <p className="hydra-muted">{isError ? error?.message || 'Fonte temporariamente indisponível.' : 'Aguardando observações suficientes.'}</p>}
        </div>
        <div className="hydra-ai-section">
          <h3>▤ Fontes consultadas</h3>
          <div className="hydra-sources">{fontes.length ? fontes.map((fonte) => <span className="hydra-source" key={fonte}>{fonte}</span>) : <span className="hydra-muted">Nenhuma fonte informada.</span>}</div>
        </div>
        <button type="button" className="hydra-ai-btn" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Atualizando…' : '↻ Atualizar análise'}</button>
        {texto && <details className="hydra-ai-details" open={expandido} onToggle={(e) => setExpandido(e.currentTarget.open)}>
          <summary>Ver relatório técnico completo</summary>
          {secoes.map((secao, index) => <div key={index}><strong>{secao.titulo}</strong>{secao.linhas.map((linha, i) => <p key={i}>{linha}</p>)}</div>)}
        </details>}
        {data?.desatualizado && <p className="hydra-muted" role="status">Exibindo o último relatório disponível: a atualização recente falhou.</p>}
        {data?.avisosFontes?.length > 0 && <p className="hydra-muted">{data.avisosFontes.join('; ')}</p>}
        <p className="hydra-ai-footnote">A IA interpreta registros oficiais e históricos. Não é previsão validada de alagamento nem substitui alertas da Defesa Civil.</p>
      </div>
    </section>
  );
}
