import { create } from 'zustand';

/**
 * Estado global do painel, alimentado pelo WebSocket da API.
 * `estado` é o snapshot completo enviado pelo servidor (bueiros, serial, modo, alertas...).
 */
const CANAIS = ['prototipo', 'inteligente'];

// Constrói um painel inteiro a partir de uma única fonte; jamais preenche com outra.
function selecionarCanal(snapshot, fonte, local = {}) {
  if (!snapshot) return null;
  const canais = snapshot.canais || {};
  const simulando = fonte === 'prototipo' && snapshot.modo === 'demo' && snapshot.simulacao?.ativo;
  const remoto = canais[fonte === 'inteligente' ? 'campo' : simulando ? 'demonstracao' : 'prototipo'] || {};
  const leituras = fonte === 'prototipo' && !simulando ? {...remoto,...local} : remoto;
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
      calibracao: simulando ? { ...original.calibracao, ...(snapshot.simulacaoCalibracoes?.[id] || {}) } : original.calibracao,
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
  // Estado de bancada separado do canal de campo.
  canalLocal: {},
  publicarNivelLocal: (entrada) => set(s => {
    const id = entrada.bueiroId || 'bueiro_1';
    const nivel = Number(entrada.nivelPct);
    if (!['bueiro_1','bueiro_2'].includes(id) || !Number.isFinite(nivel) || nivel < 0 || nivel > 100) return {};
    const antigo = s.canalLocal[id] || {};
    const timestamp = Date.now();
    const n = [...(antigo.historicoNiveis || []),nivel].slice(-50);
    const t = [...(antigo.historicoTimestamps || []),timestamp].slice(-50);
    const dt = t.length > 1 ? (timestamp - t[0])/60000 : 0;
    const delta = n.length > 1 ? nivel - n[0] : 0;
    const taxa = dt > 0 ? delta/dt : 0;
    const passos = n.slice(1).map((v,i)=>v-n[i]);
    const confiavel = dt >= 0.4 && n.length >= 10 && passos.filter(v=>v>0.1).length>=2 && passos.every(v=>v>=-0.1) && taxa>0.5;
    const tempo = nivel>=100 ? 0 : confiavel ? (100-nivel)/taxa : null;
    const diagnostico = {amostras:n.length,taxaPctMin:dt>0?Number(taxa.toFixed(2)):null,tendencia:delta>0? 'subindo':delta<0?'descendo':'estavel',confiavel,tempoAte100Min:tempo!==null&&tempo<=60?Number(tempo.toFixed(1)):null,motivo:confiavel?'Extrapolação experimental da subida dos contatos':'Aguardando série suficiente e estável para estimar enchimento'};
    const leitura = {...antigo,bueiroId:id,origem:'Arduino USB',tipoMedicao:'nivel_percentual',timestamp,nivelPct:nivel,risco:nivel>=80?'critico':nivel>=50?'atencao':'normal',conectado:true,valido:true,desatualizado:false,historicoNiveis:n,historicoTimestamps:t,historicoDistancias:[],distanciaCm:null,alturaAguaCm:null,volumeMl:null,diagnostico,tendencia:diagnostico.tendencia,taxaVariacaoMinuto:diagnostico.taxaPctMin};
    const canalLocal = {...s.canalLocal,[id]:leitura};
    return {canalLocal,estado:selecionarCanal(s.estadoBruto,s.fonteSelecionada,canalLocal)};
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
