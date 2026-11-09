/**
 * Estimativa didática para réguas discretas de 6 contatos.
 * Nunca transforma uma única subida de contato em previsão confiável.
 */
export function diagnosticarRegua(historicoNiveis = [], historicoTimestamps = [], agora = Date.now()) {
  const base = {
    amostras: 0, taxaPctMin: null, tendencia: 'indeterminado',
    confiavel: false, tempoAte100Min: null,
    motivo: 'Aguardando leituras recentes e suficientes da régua'
  };
  const serie = historicoTimestamps.map((t, i) => ({
    t: Number(t), n: historicoNiveis[i] == null ? NaN : Number(historicoNiveis[i])
  })).filter(p => Number.isFinite(p.t) && p.t > 0 &&
    Number.isFinite(p.n) && p.n >= 0 && p.n <= 100 &&
    p.t <= agora + 5000 && p.t >= agora - 120000)
    .sort((a, b) => a.t - b.t)
    .filter((p, i, arr) => i === 0 || p.t > arr[i - 1].t);

  const amostras = serie.length;
  if (!amostras) return base;
  const atual = serie.at(-1);
  if (agora < atual.t || agora - atual.t > 30000) {
    return { ...base, amostras, motivo: 'Última medição desatualizada' };
  }
  if (atual.n >= 100) return {
    ...base, amostras, tendencia: 'limite_atingido',
    taxaPctMin: 0, tempoAte100Min: 0,
    motivo: 'Contato superior atingido; 100% observado, não previsto'
  };
  const duracaoMs = atual.t - serie[0].t;
  if (amostras < 6 || duracaoMs < 15000) return {
    ...base, amostras, motivo: 'São necessárias ao menos 6 leituras em 15 segundos'
  };
  const xs = serie.map(p => (p.t - serie[0].t) / 60000);
  const xm = xs.reduce((a,b) => a+b, 0) / amostras;
  const ym = serie.reduce((a,p) => a+p.n, 0) / amostras;
  const den = xs.reduce((a,x) => a+(x-xm)**2, 0);
  const taxa = den > 0 ? serie.reduce((a,p,i) => a+(xs[i]-xm)*(p.n-ym), 0)/den : 0;
  const delta = atual.n - serie[0].n;
  const passos = serie.slice(1).map((p,i) => p.n-serie[i].n);
  const subidas = passos.filter(v => v > 0.1).length;
  const quedas = passos.filter(v => v < -0.1).length;
  const tendencia = taxa > 0.3 && delta > 0 ? 'subindo'
    : taxa < -0.3 && delta < 0 ? 'descendo' : 'estavel';
  const confiavel = duracaoMs >= 25000 && amostras >= 10 &&
    subidas >= 2 && quedas === 0 && delta >= 16 &&
    taxa >= 0.5 && taxa <= 180;
  const minutos = confiavel ? (100-atual.n)/taxa : null;
  return {
    amostras, taxaPctMin: Number(taxa.toFixed(2)), tendencia, confiavel,
    tempoAte100Min: minutos !== null && minutos >= 0 && minutos <= 60
      ? Number(minutos.toFixed(1)) : null,
    motivo: confiavel
      ? 'Extrapolação linear experimental, sujeita a mudanças na vazão'
      : tendencia === 'descendo' ? 'Água baixando; tempo de enchimento não estimável'
      : tendencia === 'estavel' ? 'Nível estável; tempo de enchimento não estimável'
      : 'Subida detectada, mas sem série estável suficiente'
  };
}
