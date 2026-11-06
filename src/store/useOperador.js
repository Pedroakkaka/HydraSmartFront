import { create } from 'zustand';

/**
 * Chave do operador (OPERATOR_API_KEY do backend).
 * Fica só na memória desta aba: some ao recarregar a página e nunca vai para
 * localStorage, cookies ou para o código publicado.
 */
export const useOperador = create(() => ({
  chave: null,
  // Pedido aberto na janela de chave: { mensagem, resolver }
  pedido: null
}));

/** Devolve a chave guardada ou abre a janela pedindo uma. Resolve null se o operador cancelar. */
export function obterChaveOperador(mensagem) {
  const { chave, pedido } = useOperador.getState();
  if (chave && !mensagem) return Promise.resolve(chave);
  if (pedido) pedido.resolver(null);
  return new Promise((resolver) => {
    useOperador.setState({ pedido: { mensagem: mensagem ?? null, resolver } });
  });
}

/** Resposta da janela: guarda a chave informada (ou nada, se cancelou) e libera quem pediu. */
export function responderPedidoChave(valor) {
  const { pedido } = useOperador.getState();
  const chave = typeof valor === 'string' && valor.trim() ? valor.trim() : null;
  useOperador.setState({ pedido: null, ...(chave ? { chave } : {}) });
  pedido?.resolver(chave);
}

export function esquecerChaveOperador() {
  useOperador.setState({ chave: null });
}
