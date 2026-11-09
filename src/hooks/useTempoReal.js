import { useEffect } from 'react';
import { api, urlWebSocket } from '../lib/api.js';
import { som } from '../lib/som.js';
import { useTelemetria } from '../store/useTelemetria.js';
import { useNotificacoesTeste, ehAlertaProtótipo, ehAlertaSimulacao, ehAlertaDeTeste, classificarFaixaTeste, exibirNotificacaoTeste } from '../lib/notificacoesTeste.js';

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
    const faixasPendentes = new Set();


    const avisarCelular = (evento, faixa = null) => {
      const optin = useNotificacoesTeste.getState();
      if (!optin.inscrito || !ehAlertaDeTeste(evento)) return;
      const idSensor = evento.alerta.bueiroId;
      if (!idSensor) return;
      const novaFaixa = faixa || (evento.dadosFaixa || (evento.acao === 'nivel_alto_teste' ? 'atencao' : 'critico'));
      const canalAlerta = ehAlertaSimulacao(evento) ? 'simulacao' : 'prototipo';
      const chaveSensor = canalAlerta + ':' + idSensor;
      const chaveFaixa = chaveSensor + ':' + novaFaixa;
      if (faixasAvisadas.get(chaveSensor) === novaFaixa || faixasPendentes.has(chaveFaixa)) return;
      const idEvento = String(evento.alerta.id ?? evento.alerta.mensagem);
      if (alertasVistos.has(idEvento)) return;
      faixasPendentes.add(chaveFaixa);
      exibirNotificacaoTeste(evento).then(exibida => {
        if (exibida) {
          faixasAvisadas.set(chaveSensor, novaFaixa);
          alertasVistos.add(idEvento);
          if (alertasVistos.size > 100) alertasVistos.delete(alertasVistos.values().next().value);
          useNotificacoesTeste.getState().receber(new Date().toISOString());
        }
      }).catch(() => {
        // Não marcar como entregue caso o navegador tenha recusado a notificação.
      }).finally(() => faixasPendentes.delete(chaveFaixa));
    };

    // Ambos os canais de teste podem notificar celulares que estejam
    // visualizando 'Análise com dados reais', sem misturar telemetria exibida.
    const verificarCanaisTeste = snapshot => {
      if (!useNotificacoesTeste.getState().inscrito) return;
      const canais = [
        ['prototipo', snapshot?.canais?.prototipo || {}],
        ...(snapshot?.simulacao?.ativo === true && snapshot?.modo === 'demo'
          ? [['simulacao', snapshot?.canais?.demonstracao || {}]] : [])
      ];
      for (const [canal, dados] of canais) {
        for (const [id, leitura] of Object.entries(dados)) {
          if (!['bueiro_1', 'bueiro_2'].includes(id)) continue;
          if (canal === 'prototipo' &&
              (leitura?.origem !== 'Arduino USB' ||
               (leitura.natureza != null && leitura.natureza !== 'experimental'))) continue;
          if (canal === 'simulacao' &&
              (leitura?.natureza !== 'sintetico' ||
               leitura?.origem !== 'Simulador (demonstração)')) continue;
          const idade = Date.now() - Number(leitura?.timestamp);
          if (!Number.isFinite(idade) || idade < 0 || idade > 30000) continue;
          const cfg = snapshot?.bueiros?.[id]?.calibracao || {};
          const faixa = classificarFaixaTeste(
            leitura.nivelPct,
            Number(cfg.limiteAtencaoPct ?? 50),
            Number(cfg.limiteCriticoPct ?? 80)
          );
          const chaveSensor = canal + ':' + id;
          if (faixa === 'normal') {
            faixasAvisadas.set(chaveSensor, 'normal');
            continue;
          }
          if (!faixa) continue;
          const prefixo = canal === 'simulacao' ? '[TESTE SIMULAÇÃO]' : '[TESTE PROTÓTIPO]';
          avisarCelular({
            acao: faixa === 'critico' ? 'disparado' : 'nivel_alto_teste',
            alerta: {
              id: canal + '-' + id + '-' + faixa + '-' + leitura.timestamp,
              bueiroId: id,
              simulado: true,
              nivelPctPico: Number(leitura.nivelPct),
              mensagem: prefixo + ' Teste do HydraSmart. NÃO É EMERGÊNCIA.'
            }
          }, faixa);
        }
      }
    };

    // Notificar diretamente das leituras USB neste navegador, mesmo quando
    // a chave da API não está configurada. Apenas dados físicos experimentais.
    const cancelarEscutaLocal = useTelemetria.subscribe((novo, antigo) => {
      if (novo.canalLocal === antigo.canalLocal || novo.fonteSelecionada !== 'prototipo') return;
      verificarCanaisTeste({
        canais: { prototipo: novo.canalLocal },
        bueiros: novo.estado?.bueiros || {},
        simulacao: { ativo: false }, modo: 'real'
      });
    });

    // Fallback HTTP para navegadores/redes que bloqueiam WebSocket.
    const buscarEstadoHttp = async () => {
      if (!ativo) return;
      try {
        const estado = await api.get('/estado');
        if (!ativo) return;
        if (socket?.readyState !== WebSocket.OPEN) definirEstado(estado);
        verificarCanaisTeste(estado);
      } catch {
        // O WebSocket segue tentando reconectar.
      }
    };
    const intervaloHttp = setInterval(buscarEstadoHttp, 5_000);
    // Sem novas leituras, o sensor deve ficar marcado como desconectado
    // mesmo que o WebSocket continue tecnicamente aberto.
    const intervaloValidade = setInterval(() => {
      useTelemetria.getState().revalidarLeituras();
    }, 5_000);
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
          verificarCanaisTeste(msg.dados);
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
      cancelarEscutaLocal();
      clearTimeout(timer);
      clearInterval(intervaloHttp);
      clearInterval(intervaloValidade);
      socket?.close();
    };
  }, []);
}
