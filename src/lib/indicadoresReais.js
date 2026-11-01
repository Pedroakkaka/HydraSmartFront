/**
 * Indicadores observacionais, sem previsão probabilística de alagamentos.
 * Nível de estação hidrológica nunca é convertido em nível de bueiro.
 */
const valido = v => v != null && v !== '' && Number.isFinite(Number(v));
const decimal = (v, casas = 1) => Number(v).toLocaleString('pt-BR', {maximumFractionDigits: casas});

export function estimarTempoExtravasamento(bueiros = {}) {
  const possibilidades = [];
  let recentes = 0;
  for (const b of Object.values(bueiros)) {
    if (!b || !b.conectado || !b.valido || b.desatualizado) continue;
    if (!valido(b.nivelPct) || !Array.isArray(b.historicoTimestamps) || !Array.isArray(b.historicoNiveis)) continue;
    recentes++;
    const pares = b.historicoTimestamps.map((t, i) => ({ t: Number(t), n: Number(b.historicoNiveis[i]) }))
      .filter(p => Number.isFinite(p.t) && Number.isFinite(p.n) && p.n >= 0 && p.n <= 100)
      .sort((a, z) => a.t - z.t);
    const atual = pares.at(-1);
    if (!atual || pares.length < 4 || Math.abs(Date.now() - atual.t) > 60_000) continue;
    const janela = pares.filter(p => p.t >= atual.t - 15 * 60_000);
    if (janela.length < 4 || atual.t - janela[0].t < 2 * 60_000) continue;
    if (atual.n >= 100) return {valor:'Limite atingido',detalhe:'Sensor de campo: 100% da altura útil; confirmar localmente.',natureza:'observado'};
    const dtMin = (atual.t - janela[0].t) / 60_000;
    const delta = atual.n - janela[0].n;
    if (delta <= 0 || delta / dtMin < 0.15) continue;
    // A regressão reduz o peso de oscilações isoladas de leitura.
    const tm = janela.reduce((a, p) => a + (p.t - janela[0].t) / 60_000, 0) / janela.length;
    const nm = janela.reduce((a, p) => a + p.n, 0) / janela.length;
    const numerador = janela.reduce((a, p) => a + (((p.t - janela[0].t) / 60_000 - tm) * (p.n - nm)), 0);
    const denominador = janela.reduce((a, p) => a + (((p.t - janela[0].t) / 60_000 - tm) ** 2), 0);
    const taxa = denominador ? numerador / denominador : 0;
    if (taxa < 0.15 || taxa > 30) continue;
    const minutos = (100 - atual.n) / taxa;
    if (minutos > 0 && minutos <= 360) possibilidades.push({minutos, nome:b.nome || b.codigoCurto || b.id || 'Sensor de campo'});
  }
  if (!possibilidades.length) {
    return {valor:'Não calculável',detalhe: recentes
      ? 'Sem tendência de subida consistente (mín. 4 leituras e 2 min).'
      : 'Aguardando sensores reais de bueiro conectados.', natureza:'indisponivel'};
  }
  const maisProximo = possibilidades.sort((a,b) => a.minutos - b.minutos)[0];
  return {valor: maisProximo.minutos < 60 ? decimal(maisProximo.minutos,0) + ' min' : decimal(maisProximo.minutos / 60,1) + ' h',
    detalhe:'Extrapolação experimental de tendência · ' + maisProximo.nome + '. Não é previsão validada.',natureza:'estimativa'};
}

export function avaliarCondicaoObservada(estacao, chuva) {
  const rio = estacao?.rio;
  const nome = estacao?.nome || estacao?.codigo || 'estação oficial';
  const nivel = valido(rio?.nivelMetros) ? decimal(rio.nivelMetros,2) + ' m' : null;
  const tendencia = valido(rio?.tendenciaMetros) ? Number(rio.tendenciaMetros) : null;
  const oficial = typeof rio?.situacaoOficial === 'string' ? rio.situacaoOficial.trim() : '';
  if (!nivel && !oficial && tendencia === null)
    return {valor:'Sem dados atuais',detalhe:'Aguardando observações hidrológicas oficiais.',natureza:'indisponivel'};
  const movimento = tendencia === null ? 'tendência não informada' :
    tendencia > 0 ? 'nível em elevação' : tendencia < 0 ? 'nível em queda' : 'nível estável';
  return {
    valor: oficial && !/^(não informad[ao]|indispon[ií]vel|sem dados)$/i.test(oficial)
      ? oficial : tendencia === null ? 'Leitura disponível' : tendencia > 0 ? 'Em elevação' : tendencia < 0 ? 'Em queda' : 'Estável',
    detalhe: (nivel ? nivel + ' · ' : '') + movimento + ' · ' + nome +
      '. Observação atual, não probabilidade para 6 h.',
    natureza:'observado'
  };
}
