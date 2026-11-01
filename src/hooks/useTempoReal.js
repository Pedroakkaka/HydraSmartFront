import { useEffect } from 'react';
import { api, urlWebSocket } from '../lib/api.js';
import { som } from '../lib/som.js';
import { useTelemetria } from '../store/useTelemetria.js';
import { useNotificacoesTeste, ehAlertaProtótipo, exibirNotificacaoTeste } from '../lib/notificacoesTeste.js';

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
    const alertasVistos = new Set();

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
        if (msg.tipo === 'alerta' && msg.dados?.acao === 'disparado') {
          // Som administrativo no painel permanece separado do aviso opcional ao celular.
          const fonte = useTelemetria.getState().fonteSelecionada;
          if ((fonte === 'prototipo' && ehAlertaProtótipo(msg.dados))
              || (fonte === 'inteligente' && msg.dados.alerta?.simulado === false)) som.sirene();
          // Só alertas de bancada identificados como TESTE podem acionar os celulares.
          const optin = useNotificacoesTeste.getState();
          if (optin.inscrito && ehAlertaProtótipo(msg.dados)) {
            const id = String(msg.dados.alerta.id ?? msg.dados.alerta.mensagem);
            if (!alertasVistos.has(id)) {
              alertasVistos.add(id);
              if (alertasVistos.size > 100) alertasVistos.delete(alertasVistos.values().next().value);
              exibirNotificacaoTeste().then(exibida => {
                if (exibida) useNotificacoesTeste.getState().receber(new Date().toISOString());
              });
            }
          }
        }
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
