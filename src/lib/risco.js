/** Metadados visuais dos níveis de risco calculados pela API. */
export const RISCO = {
  normal: { rotulo: 'Normal', cor: '#10b981', classe: 'normal' },
  atencao: { rotulo: 'Atenção', cor: '#f59e0b', classe: 'warning' },
  critico: { rotulo: 'Crítico', cor: '#ef4444', classe: 'danger' },
  desconhecido: { rotulo: 'Sem Sinal', cor: '#64748b', classe: 'muted' }
};

export const metaRisco = (risco) => RISCO[risco] ?? RISCO.desconhecido;

/** Bueiro com leitura válida e utilizável no painel. */
export const temLeitura = (b) => Boolean(b?.conectado && b?.valido);

/** Situação geral considerando os dois bueiros. */
export function situacaoGeral(bueiros) {
  const lista = Object.values(bueiros ?? {}).filter(temLeitura);
  if (lista.some((b) => b.risco === 'critico')) return 'critico';
  if (lista.some((b) => b.risco === 'atencao')) return 'atencao';
  return 'normal';
}
