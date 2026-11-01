import { useEffect } from 'react';
import { api, urlWebSocket } from '../lib/api.js';
import { som } from '../lib/som.js';
import { useTelemetria } from '../store/useTelemetria.js';

/**
 * Mantém a conexão WebSocket com a API e atualiza o estado global.
 * Reconecta sozinho com espera crescente (1 s, 2 s, 4 s... até 10 s).
 */
export function useTempoReal() {
  useEffect(() => {
    const { definirEstado, definirConexao } = useTelemetria.getState();
    let socket;
    let tentativa = 0;
    let timer;
    let ativo = true;

    // Fallback HTTP para navegadores/redes que bloqueiam WebSocket.
    const buscarEstadoHttp = async () => {
      if (!ativo || socket?.readyState === WebSocket.OPEN) return;
      try {
        const estado = await api.get('/estado');
        if (ativo && socket?.readyState !== WebSocket.OPEN) definirEstado(estado);
      } catch {
        // O WebSocket segue tentando reconectar.
      }
    };
    const intervaloHttp = setInterval(buscarEstadoHttp, 15_000);
    buscarEstadoHttp();

    const conectar = () => {
      definirConexao('conectando');
      socket = new WebSocket(urlWebSocket());

      socket.onopen = () => {
        tentativa = 0;
        definirConexao('online');
      };

      socket.onmessage = (evento) => {
        let msg;
        try {
          msg = JSON.parse(evento.data);
        } catch {
          return;
        }
        if (msg.tipo === 'estado') definirEstado(msg.dados);
        if (msg.tipo === 'alerta' && msg.dados?.acao === 'disparado') som.sirene();
      };

      socket.onclose = () => {
        if (!ativo) return;
        definirConexao('offline');
        const espera = Math.min(10_000, 1000 * 2 ** tentativa++);
        timer = setTimeout(conectar, espera);
      };

      socket.onerror = () => socket.close();
    };

    conectar();
    return () => {
      ativo = false;
      clearTimeout(timer);
      clearInterval(intervaloHttp);
      socket?.close();
    };
  }, []);
}
