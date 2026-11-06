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

/** Liga/desliga a simulação. A chave do operador é pedida e anexada pelo cliente da API. */
export function useAlternarModo() {
  const { executar, ocupado } = useAcao();
  const alternar = () => {
    const modo = useTelemetria.getState().estado?.modo;
    return modo === 'demo'
      ? executar(() => api.post('/simulacao/encerrar'), { beep: 850, sucesso: 'Modo real reativado' })
      : executar(() => api.post('/simulacao/iniciar', { cenario: 'chuva_moderada' }), { beep: 650, sucesso: 'Modo demonstração ativado' });
  };
  return { alternar, ocupado };
}
