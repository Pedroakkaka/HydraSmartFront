import { useState } from 'react';
import { api } from '../lib/api.js';
import { som } from '../lib/som.js';
import { avisar, useTelemetria } from '../store/useTelemetria.js';

/**
 * Executa uma ação na API com estado de "ocupado" e aviso de erro.
 * O resultado aparece no painel pelo WebSocket, então não é preciso recarregar nada.
 */
export function useAcao() {
  const [ocupado, setOcupado] = useState(false);
  const executar = async (fn, { sucesso, beep = 880 } = {}) => {
    setOcupado(true);
    try {
      const r = await fn();
      if (beep) som.beep(beep);
      if (sucesso) avisar(sucesso);
      return r;
    } catch (err) {
      // Operador fechou a janela da chave: não é erro, só não executa.
      if (!err.cancelado) avisar(err.message, 'erro');
      return undefined;
    } finally {
      setOcupado(false);
    }
  };
  return { executar, ocupado };
}

/**
 * Executa uma ação protegida. A chave do operador é anexada pelo cliente da API
 * (pedida uma vez numa janela e guardada só em memória); `fn` recebe cabeçalhos
 * vazios para manter a assinatura usada pelas páginas.
 */
export function useAcaoProtegida() {
  const { executar, ocupado } = useAcao();
  const executarProtegida = (fn, opcoes) => executar(() => fn({}), opcoes);
  return { executarProtegida, ocupado };
}

/** Liga/desliga a simulação. */
export function useAlternarModo() {
  const { executarProtegida, ocupado } = useAcaoProtegida();
  const alternar = () => {
    const modo = useTelemetria.getState().estado?.modo;
    return modo === 'demo'
      ? executarProtegida((headers) => api.post('/simulacao/encerrar', {}, headers), { beep: 850, sucesso: 'Modo real reativado' })
      : executarProtegida((headers) => api.post('/simulacao/iniciar', { cenario: 'chuva_moderada' }, headers), { beep: 650, sucesso: 'Modo demonstração ativado' });
  };
  return { alternar, ocupado };
}
