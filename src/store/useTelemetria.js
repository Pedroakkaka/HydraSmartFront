import { create } from 'zustand';

/**
 * Estado global do painel, alimentado pelo WebSocket da API.
 * `estado` é o snapshot completo enviado pelo servidor (bueiros, serial, modo, alertas...).
 */
export const useTelemetria = create((set) => ({
  estado: null,
  conexao: 'conectando', // 'conectando' | 'online' | 'offline'
  alertasDispensados: [],

  definirEstado: (estado) => set({ estado }),
  definirConexao: (conexao) => set({ conexao }),
  dispensarAlertas: (ids) =>
    set((s) => ({ alertasDispensados: [...new Set([...s.alertasDispensados, ...ids])] }))
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
