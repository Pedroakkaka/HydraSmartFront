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
  // Resumos curtos devem terminar em uma frase completa; nunca cortar palavras,
  // entidades HTML ou marcações Markdown no meio.
  const original = (resumoSecao?.linhas.join(' ') || secoes[0]?.linhas.join(' ') || '')
    .replace(/&#(x[0-9a-fA-F]+|[0-9]+);/g, (token, code) => {
      const numero = code.startsWith('x') ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return numero > 0 && numero <= 0x10ffff ? String.fromCodePoint(numero) : token;
    })
    .replace(/&(?:nbsp|amp|quot|apos|lt|gt);/g, (token) => ({
      '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>'
    })[token])
    .replace(/\\*\\*|__/g, '')
    .replace(/\\s+/g, ' ')
    .trim();
  const frases = original.match(/[^.!?]+[.!?]+(?=\\s|$)/g) || [];
  const resumo = frases.length ? frases.slice(0, 2).join(' ').trim() : original;
  const tendencias = secoes.find((s) => /tend[eê]ncias|limita[cç][oõ]es/i.test(s.titulo));
  const observacoes = secoes.find((s) => /observa[cç][oõ]es atuais/i.test(s.titulo));
  const achados = [...(observacoes?.linhas || []), ...(tendencias?.linhas || [])].slice(0, 3);
  return { resumo, achados, secoes };
}

function interpretarSensores(bueiros = {}, demonstracao = false) {
  const leituras = Object.values(bueiros).filter(b => b?.valido && b?.conectado && !b?.desatualizado && Number.isFinite(Number(b.nivelPct)));
  const origem = demonstracao ? 'Projeto físico ou simulação digital' : 'Sensores de campo';
  if (!leituras.length) return { resumo: `${origem}: aguardando leituras atuais. Não é possível concluir a condição dos bueiros.`, achados: ['Sem leituras recentes para análise.'] };
  const maior = leituras.reduce((a,b) => Number(a.nivelPct) >= Number(b.nivelPct) ? a : b);
  const nivel = Number(maior.nivelPct).toFixed(1);
  const classe = maior.risco === 'critico' ? 'crítico' : maior.risco === 'atencao' ? 'de atenção' : 'normal';
  const tendencia = maior.tendencia === 'elevacao' ? 'em elevação' : maior.tendencia === 'queda' ? 'em queda' : 'sem tendência de elevação confirmada';
  const achados = [`${leituras.length} sensor(es) com leitura atual.`, `Maior nível: ${nivel}% (${classe}); tendência ${tendencia}.`];
  if (maior.diagnostico) {
    achados.push(`Variação observada: ${maior.diagnostico.taxaPctMin == null ? 'não calculada' : maior.diagnostico.taxaPctMin + ' %/min'}. ${maior.diagnostico.motivo}`);
  } else if (maior.confiabilidadeTendencia?.confiavel === false) achados.push('Tendência ainda sem confiança suficiente: ' + maior.confiabilidadeTendencia.motivo);
  return { resumo: `${origem}: maior nível observado de ${nivel}%, situação ${classe}, ${tendencia}. ${demonstracao ? 'Dados experimentais/simulados de demonstração; não representam condição real da cidade.' : 'Leituras instrumentais; confirmar calibração e atualidade.'}`, achados };
}

export default function AnaliseIntegrada({ estacao, chuva, bueiros, demonstracao = false }) {
  const [expandido, setExpandido] = useState(false);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['analise-generativa-compartilhada', demonstracao ? 'prototipo' : 'real'],
    queryFn: () => api.get(`/ia/relatorio-contextual?modo=${demonstracao ? 'prototipo' : 'real'}`),
    retry: false,
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: false
  });
  const texto = typeof (data?.analise || data?.relatorio) === 'string' ? (data.analise || data.relatorio) : '';
  const oficial = extrairResumo(texto);
  const contextual = interpretarSensores(bueiros, demonstracao);
  const { resumo, achados, secoes } = { ...contextual, secoes: oficial.secoes };
  
  const fontes = [...new Set((data?.fontes || []).map((f) => f.fonte).filter(Boolean))];
  const sensoresValidos = Object.values(bueiros || {}).filter(b => b?.valido && b?.conectado && !b?.desatualizado);
  const sensorMaior = sensoresValidos.reduce((max, b) => !max || Number(b.nivelPct) > Number(max.nivelPct) ? b : max, null);
  const diagnostico = demonstracao && sensorMaior?.origem === 'Arduino USB' ? sensorMaior.diagnostico : null;
  const tempoEncher = diagnostico?.tempoAte100Min === 0 ? 'Máximo atingido' : diagnostico?.confiavel && diagnostico.tempoAte100Min != null ? `${Number(diagnostico.tempoAte100Min).toLocaleString('pt-BR', {maximumFractionDigits:1})} min` : 'Não calculável';
  const nivel = estacao?.rio?.nivelMetros;
  const tendencia = estacao?.rio?.tendenciaMetros;
  const formatar = (v, unidade = '') => v == null || !Number.isFinite(Number(v)) ? '—' : `${Number(v).toLocaleString('pt-BR', {maximumFractionDigits: 2})}${unidade}`;

  return (
    <section className="hydra-panel hydra-ai" aria-label="Análise contextual do histórico">
      <header className="hydra-ai-header">
        <h2>▱ Análise contextual do histórico</h2>
        <span>{demonstracao ? 'Atualização conforme telemetria da bancada' : data?.verificadoEm ? `Verificado: ${new Date(data.verificadoEm).toLocaleTimeString('pt-BR')}` : data?.geradoEm ? new Date(data.geradoEm).toLocaleString('pt-BR') : 'Verificação a cada 5 s'}</span>
      </header>
      <div className="hydra-ai-body">
        <div className="hydra-ai-summary">
          <strong>{'✦ Análise contextual · ' + (demonstracao ? 'projeto físico' : 'dados reais')}</strong>
          <p>{resumo}</p>
        </div>
        <p className="hydra-ai-footnote">{demonstracao ? 'Análise determinística local contínua; interpretação generativa opcional com cache no servidor.' : 'Análise contextual atualizada com a telemetria; relatório consultivo oficial consultado a cada 5 segundos (respeitando cache do servidor).'}</p>
        <div className="hydra-insights">
          <div className="hydra-insight"><span className="hs-insight-icon">♧</span><span>{demonstracao ? 'Nível do protótipo' : 'Nível oficial'}</span><strong>{demonstracao ? formatar(sensorMaior?.nivelPct, '%') : formatar(nivel, ' m')}</strong><small>{demonstracao ? 'Bueiro de bancada' : estacao?.codigo ?? 'Sem estação'}</small></div>
          <div className="hydra-insight"><span className="hs-insight-icon">↗</span><span>{demonstracao ? 'Velocidade de subida' : 'Tendência oficial'}</span><strong>{demonstracao ? (diagnostico?.taxaPctMin != null ? formatar(diagnostico.taxaPctMin, ' %/min') : '—') : formatar(tendencia, ' m')}</strong><small>{demonstracao ? (diagnostico?.tendencia || 'Aguardando série') : 'Valor informado pela estação'}</small></div>
          <div className="hydra-insight"><span className="hs-insight-icon">☁</span><span>Precipitação</span><strong>{formatar(chuva, ' mm')}</strong><small>Open-Meteo</small></div>
          <div className="hydra-insight"><span className="hs-insight-icon">◷</span><span>{demonstracao ? 'Tempo até 100% · bancada' : 'Janela crítica'}</span><strong>{demonstracao ? tempoEncher : '—'}</strong><small>{demonstracao ? (diagnostico?.motivo || 'Aguardando histórico físico') : 'Não calculada'}</small></div>
        </div>
        {<div className="hydra-ai-section"><h3>IA generativa · {demonstracao ? 'protótipo experimental' : 'dados reais'}</h3><p>{isLoading ? 'Consultando fontes…' : isError ? 'Relatório indisponível.' : oficial.resumo || data?.mensagem || 'Sem relatório disponível.'}</p><small>{data?.geradoEm ? `Texto gerado em ${new Date(data.geradoEm).toLocaleTimeString('pt-BR')}. Atualizações da telemetria a cada leitura; a geração de texto usa cache e depende de habilitação no servidor.` : 'Sem texto gerado confirmado nesta sessão.'}</small></div>}
        <div className="hydra-ai-section">
          <h3>◎ Principais achados</h3>
          {achados.length ? <ul className="hydra-findings">{achados.map((item, index) => <li key={index}>{item}</li>)}</ul>
            : <p className="hydra-muted">{isError ? error?.message || 'Fonte temporariamente indisponível.' : 'Aguardando observações suficientes.'}</p>}
        </div>
        <div className="hydra-ai-section">
          <h3>▤ Fontes consultadas</h3>
          <div className="hydra-sources">{demonstracao ? <span className="hydra-source">Sensores do projeto físico · bancada</span> : fontes.length ? fontes.map((fonte) => <span className="hydra-source" key={fonte}>{fonte}</span>) : <span className="hydra-muted">Nenhuma fonte informada.</span>}</div>
        </div>
        {<button type="button" className="hydra-ai-btn" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Atualizando…' : '↻ Atualizar análise'}</button>}
        {texto && <details className="hydra-ai-details" open={expandido} onToggle={(e) => setExpandido(e.currentTarget.open)}>
          <summary>Ver relatório técnico completo</summary>
          {secoes.map((secao, index) => <div key={index}><strong>{secao.titulo}</strong>{secao.linhas.map((linha, i) => <p key={i}>{linha}</p>)}</div>)}
        </details>}
        {data?.desatualizado && <p className="hydra-muted" role="status">Exibindo o último relatório disponível: a atualização recente falhou.</p>}
        {data?.avisosFontes?.length > 0 && <p className="hydra-muted">{data.avisosFontes.join('; ')}</p>}
        <p className="hydra-ai-footnote">{demonstracao ? 'A análise determinística continua disponível sem IA. A interpretação generativa do protótipo requer habilitação no servidor; dados experimentais não são registros oficiais.' : 'A mesma IA generativa, quando habilitada, interpreta a fonte selecionada, com cache independente por modo. Não define riscos nem alertas.'}</p>
      </div>
    </section>
  );
}
