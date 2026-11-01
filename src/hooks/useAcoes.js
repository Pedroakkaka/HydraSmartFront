import { useState } from 'react';
import { api } from '../lib/api.js';
import { som } from '../lib/som.js';
import { avisar, useTelemetria } from '../store/useTelemetria.js';
import { cabecalhoOperador } from '../lib/operador.js';

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

/** Solicita a chave só para a ação atual; não a persiste no estado do frontend. */
export function useAcaoProtegida() {
  const { executar, ocupado } = useAcao();
  const executarProtegida = (fn, opcoes) => {
    const chave = window.prompt('Informe a chave de operador configurada no backend (OPERATOR_API_KEY):');
    if (chave === null) return undefined;
    const headers = cabecalhoOperador(chave);
    if (!headers) {
      avisar('Informe a chave de operador para executar esta ação.', 'erro');
      return undefined;
    }
    return executar(() => fn(headers), opcoes);
  };
  return { executarProtegida, ocupado };
}

/** Liga/desliga a simulação com autenticação explícita do operador.
 * A chave nunca é armazenada no frontend nem incluída no código publicado.
 */
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
