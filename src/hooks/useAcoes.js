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
      avisar(err.message, 'erro');
      return undefined;
    } finally {
      setOcupado(false);
    }
  };
  return { executar, ocupado };
}

/** Liga/desliga a simulação com autenticação explícita do operador.
 * A chave nunca é armazenada no frontend nem incluída no código publicado.
 */
export function useAlternarModo() {
  const { executar, ocupado } = useAcao();
  const alternar = () => {
    const modo = useTelemetria.getState().estado?.modo;
    const chave = window.prompt('Informe a chave de operador configurada no backend (OPERATOR_API_KEY):');
    if (chave === null) return;
    if (!chave.trim()) {
      avisar('Informe a chave de operador para alternar o modo.', 'erro');
      return;
    }
    const headers = { 'X-Operator-Key': chave.trim() };
    return modo === 'demo'
      ? executar(() => api.post('/simulacao/encerrar', {}, headers), { beep: 850, sucesso: 'Modo real reativado' })
      : executar(() => api.post('/simulacao/iniciar', { cenario: 'chuva_moderada' }, headers), { beep: 650, sucesso: 'Modo demonstração ativado' });
  };
  return { alternar, ocupado };
}
