/**
 * Quando o WebSocket está aberto, a telemetria já chega por eventos.
 * Consultas HTTP de 5 em 5 segundos ficam reservadas ao fallback offline.
 */
export function necessitaFallbackHttp(socket) {
  return !socket || socket.readyState !== 1; // WebSocket.OPEN = 1
}
