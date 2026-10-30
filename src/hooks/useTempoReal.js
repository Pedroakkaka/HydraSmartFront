import { useEffect } from 'react';
import { urlWebSocket } from '../lib/api.js';
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
      socket?.close();
    };
  }, []);
}
