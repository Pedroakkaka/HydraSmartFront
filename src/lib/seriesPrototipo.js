/**
 * Alinha amostras independentes das duas réguas por timestamp.
 * Não preenche lacunas com leituras de outro bueiro ou valores inventados.
 */
export function montarSeriesAoVivo(b1 = {}, b2 = {}) {
  const pontos = (b = {}) => {
    const tempos = Array.isArray(b.historicoTimestamps) ? b.historicoTimestamps : [];
    const niveis = Array.isArray(b.historicoNiveis) ? b.historicoNiveis : [];
    const m = new Map();
    for (let i = 0; i < Math.min(tempos.length, niveis.length); i++) {
      const t = Number(tempos[i]);
      const nivel = Number(niveis[i]);
      if (!Number.isFinite(t) || t <= 0 || niveis[i] == null ||
          !Number.isFinite(nivel) || nivel < 0 || nivel > 100) continue;
      m.set(t, nivel);
    }
    return m;
  };
  const um = pontos(b1);
  const dois = pontos(b2);
  const tempos = [...new Set([...um.keys(), ...dois.keys()])].sort((a, b) => a - b);
  return {
    tempos,
    b1: tempos.map(t => um.get(t) ?? null),
    b2: tempos.map(t => dois.get(t) ?? null),
    amostrasB1: um.size,
    amostrasB2: dois.size
  };
}
