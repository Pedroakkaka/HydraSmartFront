import { create } from 'zustand';

/**
 * Estado global do painel, alimentado pelo WebSocket da API.
 * `estado` é o snapshot completo enviado pelo servidor (bueiros, serial, modo, alertas...).
 */
const CANAIS = ['prototipo', 'inteligente'];

// Constrói um painel inteiro a partir de uma única fonte; jamais preenche com outra.
function selecionarCanal(snapshot, fonte) {
  if (!snapshot) return null;
  const canais = snapshot.canais || {};
  const simulando = fonte === 'prototipo' && snapshot.modo === 'demo' && snapshot.simulacao?.ativo;
  const leituras = canais[fonte === 'inteligente' ? 'campo' : simulando ? 'demonstracao' : 'prototipo'] || {};
  const bueiros = Object.fromEntries(Object.entries(snapshot.bueiros || {}).map(([id, original]) => {
    const leitura = leituras[id];
    const recente = leitura && Date.now() - Number(leitura.timestamp) <= 30000;
    if (!recente) return [id, {
      ...original, conectado: false, valido: false, desatualizado: true,
      origem: fonte === 'prototipo' ? 'Aguardando protótipo físico' : 'Aguardando sensores de campo',
      nivelPct: 0, alturaAguaCm: 0, volumeMl: 0,
      distanciaMedidaCm: null, timestamp: null,
      risco: 'desconhecido', historicoNiveis: [], historicoTimestamps: [], historicoDistancias: []
    }];
    return [id, {
      ...original, ...leitura, valido: true, conectado: true, desatualizado: false,
      distanciaMedidaCm: leitura.distanciaCm,
      historicoNiveis: leitura.historicoNiveis || [leitura.nivelPct],
      historicoTimestamps: leitura.historicoTimestamps || [leitura.timestamp],
      historicoDistancias: leitura.historicoDistancias || [leitura.distanciaCm]
    }];
  }));
  const ativos = (snapshot.alertasAtivos || []).filter((a) => fonte === 'inteligente'
    ? !a.simulado
    : a.simulado && (a.mensagem || '').startsWith('[TESTE PROTÓTIPO]'));
  return {
    ...snapshot, bueiros, alertasAtivos: ativos,
    modo: simulando ? 'demo' : 'real',
    fonteSelecionada: fonte
  };
}

export const useTelemetria = create((set) => ({
  estadoBruto: null,
  estado: null,
  fonteSelecionada: 'inteligente',
  conexao: 'conectando',
  alertasDispensados: [],

  definirEstado: (estadoBruto) => set(s => ({
    estadoBruto,
    estado: selecionarCanal(estadoBruto, s.fonteSelecionada)
  })),
  selecionarFonte: (fonte) => {
    if (!CANAIS.includes(fonte)) return;
    set(s => ({
      fonteSelecionada: fonte,
      estado: selecionarCanal(s.estadoBruto, fonte),
      alertasDispensados: []
    }));
  },
  definirConexao: (conexao) => set({ conexao }),
  dispensarAlertas: (ids) =>
    set(s => ({ alertasDispensados: [...new Set([...s.alertasDispensados, ...ids])] }))
}));

/** Avisos rápidos (toasts) no canto da tela. */
let proximoId = 1;
export const useAvisos = create((set) => ({
  avisos: [],
  avisar: (texto, tipo = 'sucesso') => {
    const id = proximoId++;
    set((s) => ({ avisos: [...s.avisos, { id, texto, tipo }] }));
    setTimeout(() => set((s) => ({ avisos: s.avisos.filter((a) => a.id !== id) })), 4500);
  },
  remover: (id) => set((s) => ({ avisos: s.avisos.filter((a) => a.id !== id) }))
}));

export const avisar = (texto, tipo) => useAvisos.getState().avisar(texto, tipo);
