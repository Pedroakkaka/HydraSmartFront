import { afterEach, describe, expect, it, vi } from 'vitest';
import { selecionarCanal, useTelemetria } from './useTelemetria.js';

const agora = 1_800_000_000_000;
const cfg = { limiteAtencaoPct: 50, limiteCriticoPct: 80 };
const base = () => ({
  modo: 'real',
  simulacao: { ativo: false },
  canais: { prototipo: {}, demonstracao: {}, campo: {} },
  bueiros: {
    bueiro_1: { id: 'bueiro_1', calibracao: cfg },
    bueiro_2: { id: 'bueiro_2', calibracao: cfg }
  },
  geradoEm: agora
});
const leitura = (pct, timestamp = agora) => ({
  nivelPct: pct, timestamp,
  historicoNiveis: [pct], historicoTimestamps: [timestamp],
  natureza: 'experimental', origem: 'Arduino USB'
});

afterEach(() => vi.useRealTimers());

describe('isolamento e validade da telemetria física', () => {
  it('atualiza B01 sem inventar nível de B02', () => {
    vi.useFakeTimers();
    vi.setSystemTime(agora);
    const estado = selecionarCanal(base(), 'prototipo', { bueiro_1: leitura(33.3) });
    expect(estado.bueiros.bueiro_1.nivelPct).toBe(33.3);
    expect(estado.bueiros.bueiro_2.valido).toBe(false);
    expect(estado.bueiros.bueiro_2.historicoNiveis).toEqual([]);
  });

  it('prioriza USB local atual sem perder o canal remoto independente', () => {
    vi.setSystemTime(agora);
    const snapshot = base();
    snapshot.canais.prototipo.bueiro_1 = leitura(16.7);
    snapshot.canais.prototipo.bueiro_2 = leitura(50);
    const estado = selecionarCanal(snapshot, 'prototipo', { bueiro_1: leitura(66.7) });
    expect(estado.bueiros.bueiro_1.nivelPct).toBe(66.7);
    expect(estado.bueiros.bueiro_2.nivelPct).toBe(50);
  });

  it('não exibe leitura velha ou futura como atual', () => {
    vi.setSystemTime(agora);
    const snapshot = base();
    snapshot.canais.prototipo.bueiro_1 = leitura(80, agora - 31000);
    snapshot.canais.prototipo.bueiro_2 = leitura(100, agora + 60000);
    const estado = selecionarCanal(snapshot, 'prototipo');
    expect(estado.bueiros.bueiro_1.valido).toBe(false);
    expect(estado.bueiros.bueiro_2.valido).toBe(false);
  });

  it('invalida uma leitura do Arduino quando deixa de chegar dado', () => {
    vi.setSystemTime(agora);
    const store = useTelemetria.getState();
    store.selecionarFonte('prototipo');
    store.definirEstado(base());
    store.publicarNivelLocal({ bueiroId: 'bueiro_1', nivelPct: 16.7 });
    expect(useTelemetria.getState().estado.bueiros.bueiro_1.valido).toBe(true);
    vi.setSystemTime(agora + 31000);
    useTelemetria.getState().revalidarLeituras();
    expect(useTelemetria.getState().estado.bueiros.bueiro_1.valido).toBe(false);
  });
});
