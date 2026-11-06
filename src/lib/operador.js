/** Constrói cabeçalho efêmero para uma ação administrativa autenticada. */
export function cabecalhoOperador(chave) {
  if (typeof chave !== 'string' || !chave.trim()) return null;
  return { 'X-Operator-Key': chave.trim() };
}
