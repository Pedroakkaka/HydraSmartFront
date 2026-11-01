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
    const faixasAvisadas = new Map();


    const avisarCelular = (evento, faixa = null) => {
      const optin = useNotificacoesTeste.getState();
      if (!optin.inscrito || !ehAlertaProtótipo(evento)) return;
      const idSensor = evento.alerta.bueiroId;
      if (!idSensor) return;
      const novaFaixa = faixa || (evento.dadosFaixa || (evento.acao === 'nivel_alto_teste' ? 'atencao' : 'critico'));
      if (faixasAvisadas.get(idSensor) === novaFaixa) return;
      faixasAvisadas.set(idSensor, novaFaixa);
      const idEvento = String(evento.alerta.id ?? evento.alerta.mensagem);
      if (alertasVistos.has(idEvento)) return;
      alertasVistos.add(idEvento);
      if (alertasVistos.size > 100) alertasVistos.delete(alertasVistos.values().next().value);
      exibirNotificacaoTeste(evento).then(exibida => {
        if (exibida) useNotificacoesTeste.getState().receber(new Date().toISOString());
      });
    };

    // Redundância no navegador: reage às leituras genuínas do canal de bancada,
    // inclusive quando a API ainda não publica o evento específico nivel_alto_teste.
    // Nunca utiliza o canal de campo ou o simulador virtual.
    const verificarPrototipo = snapshot => {
      if (!useNotificacoesTeste.getState().inscrito) return;
      for (const [id, leitura] of Object.entries(snapshot?.canais?.prototipo || {})) {
        if (leitura?.natureza !== 'experimental' || leitura?.origem !== 'Arduino USB') continue;
        const idade = Date.now() - Number(leitura.timestamp);
        if (!Number.isFinite(idade) || idade < 0 || idade > 30_000) continue;
        const pct = Number(leitura.nivelPct);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) continue;
        const cfg = snapshot?.bueiros?.[id]?.calibracao || {};
        const atencao = Number(cfg.limiteAtencaoPct ?? 50);
        const critico = Number(cfg.limiteCriticoPct ?? 80);
        const faixa = pct >= critico ? 'critico' : pct >= atencao ? 'atencao' : 'normal';
        if (faixa === 'normal') {
          faixasAvisadas.set(id, 'normal');
          continue;
        }
        avisarCelular({
          acao: faixa === 'critico' ? 'disparado' : 'nivel_alto_teste',
          alerta: {
            id: 'leitura-prototipo-' + id + '-' + faixa + '-' + leitura.timestamp,
            bueiroId: id,
            simulado: true,
            nivelPctPico: pct,
            mensagem: '[TESTE PROTÓTIPO] Leitura automática de bancada. NÃO É EMERGÊNCIA.'
          }
        }, faixa);
      }
    };

    // Fallback HTTP para navegadores/redes que bloqueiam WebSocket.
    const buscarEstadoHttp = async () => {
      if (!ativo || socket?.readyState === WebSocket.OPEN) return;
      try {
        const estado = await api.get('/estado');
        if (ativo && socket?.readyState !== WebSocket.OPEN) {
          definirEstado(estado);
          verificarPrototipo(estado);
        }
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
        if (msg.tipo === 'estado') {
          definirEstado(msg.dados);
          verificarPrototipo(msg.dados);
        }
        if (msg.tipo === 'alerta' && (msg.dados?.acao === 'disparado' || msg.dados?.acao === 'nivel_alto_teste')) {
          // Som administrativo no painel permanece separado do aviso opcional ao celular.
          const fonte = useTelemetria.getState().fonteSelecionada;
          if ((fonte === 'prototipo' && msg.dados.acao === 'disparado' && ehAlertaProtótipo(msg.dados))
              || (fonte === 'inteligente' && msg.dados.alerta?.simulado === false)) som.sirene();
          // O disparo do Core também alimenta o mesmo controle de faixa.
          avisarCelular(msg.dados);
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
