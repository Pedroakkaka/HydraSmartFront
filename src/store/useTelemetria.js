import { create } from 'zustand';
import { diagnosticarRegua } from '../lib/diagnosticoRegua.js';

/**
 * Estado global do painel, alimentado pelo WebSocket da API.
 * `estado` é o snapshot completo enviado pelo servidor (bueiros, serial, modo, alertas...).
 */
const CANAIS = ['prototipo', 'inteligente'];

// Constrói um painel inteiro a partir de uma única fonte; jamais preenche com outra.
export function selecionarCanal(snapshot, fonte, local = {}) {
  if (!snapshot) {
    if (fonte !== 'prototipo') return null;
    snapshot = {modo:'real',simulacao:{ativo:false},canais:{prototipo:{}},bueiros:{
      bueiro_1:{id:'bueiro_1',nome:'Régua de nível · Arduino',calibracao:{limiteAtencaoPct:50,limiteCriticoPct:80}},
      bueiro_2:{id:'bueiro_2',nome:'Régua de nível B02 · aguardando hardware',calibracao:{limiteAtencaoPct:50,limiteCriticoPct:80}}
    }};
  }
  const canais = snapshot.canais || {};
  const recente = b => {
    const ts = Number(b?.timestamp);
    return Number.isFinite(ts) && ts > 0 && Date.now() >= ts && Date.now() - ts <= 30000 &&
      b.nivelPct != null && Number.isFinite(Number(b.nivelPct));
  };
  const temUsbLocal = Object.values(local).some(recente);
  const simulando = fonte === 'prototipo' && !temUsbLocal && snapshot.modo === 'demo' && snapshot.simulacao?.ativo;
  const remoto = canais[fonte === 'inteligente' ? 'campo' : simulando ? 'demonstracao' : 'prototipo'] || {};
  const localRecentes = Object.fromEntries(Object.entries(local).filter(([,b]) => recente(b)));
  const leituras = fonte === 'prototipo' && !simulando ? {...remoto,...localRecentes} : remoto;
  const bueiros = Object.fromEntries(Object.entries(snapshot.bueiros || {}).map(([id, original]) => {
    const leitura = leituras[id];
    if (!recente(leitura)) return [id, {
      ...original, conectado: false, valido: false, desatualizado: true,
      origem: fonte === 'prototipo' ? 'Aguardando protótipo físico' : 'Aguardando sensores de campo',
      nivelPct: 0, alturaAguaCm: 0, volumeMl: 0,
      distanciaMedidaCm: null, timestamp: null,
      risco: 'desconhecido', historicoNiveis: [], historicoTimestamps: [], historicoDistancias: []
    }];
    return [id, {
      ...original, ...leitura, valido: true, conectado: true, desatualizado: false,
      calibracao: simulando ? { ...original.calibracao, ...(snapshot.simulacaoCalibracoes?.[id] || {}) } : original.calibracao,
      distanciaMedidaCm: leitura.distanciaCm ?? null,
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
  // Estado de bancada separado do canal de campo.
  canalLocal: {},
  publicarNivelLocal: (entrada) => set(s => {
    const id = entrada.bueiroId || 'bueiro_1';
    const nivel = Number(entrada.nivelPct);
    if (!['bueiro_1','bueiro_2'].includes(id) || entrada.nivelPct == null || !Number.isFinite(nivel) || nivel < 0 || nivel > 100) return {};
    const antigo = s.canalLocal[id] || {};
    const timestamp = Date.now();
    const n = [...(antigo.historicoNiveis || []),nivel].slice(-50);
    const t = [...(antigo.historicoTimestamps || []),timestamp].slice(-50);
    const diagnostico = diagnosticarRegua(n, t, timestamp);
    const leitura = {...antigo,bueiroId:id,origem:'Arduino USB',tipoMedicao:'nivel_percentual',timestamp,nivelPct:nivel,risco:nivel>=80?'critico':nivel>=50?'atencao':'normal',conectado:true,valido:true,desatualizado:false,historicoNiveis:n,historicoTimestamps:t,historicoDistancias:[],distanciaCm:null,alturaAguaCm:null,volumeMl:null,diagnostico,tendencia:diagnostico.tendencia,taxaVariacaoMinuto:diagnostico.taxaPctMin};
    const canalLocal = {...s.canalLocal,[id]:leitura};
    return {canalLocal,estado:selecionarCanal(s.estadoBruto,s.fonteSelecionada,canalLocal)};
  }),
  // Reavalia a validade temporal quando um Arduino para de transmitir,
  // inclusive se o WebSocket permanecer aberto sem novos eventos.
  revalidarLeituras: () => set(s => {
    if (s.fonteSelecionada !== 'prototipo' || !s.estado) return s;
    const invalidados = Object.values(s.estado.bueiros || {}).some(b =>
      b?.valido && (!b.timestamp || Date.now() - Number(b.timestamp) > 30000));
    if (!invalidados) return s;
    return { estado: selecionarCanal(s.estadoBruto, s.fonteSelecionada, s.canalLocal) };
  }),
  usbLocalConectado: false,
  definirUsbLocal: (conectado) => set({ usbLocalConectado: Boolean(conectado) }),
  alertasDispensados: [],

  definirEstado: (estadoBruto) => set(s => ({
    estadoBruto,
    estado: selecionarCanal(estadoBruto, s.fonteSelecionada, s.canalLocal)
  })),
  selecionarFonte: (fonte) => {
    if (!CANAIS.includes(fonte)) return;
    set(s => ({
      fonteSelecionada: fonte,
      estado: selecionarCanal(s.estadoBruto, fonte, s.canalLocal),
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
