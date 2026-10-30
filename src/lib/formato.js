const FUSO = 'America/Cuiaba';

export const hora = (ts) =>
  ts ? new Date(ts).toLocaleTimeString('pt-BR', { timeZone: FUSO }) : '--:--:--';

export const horaCurta = (ts) =>
  ts ? new Date(ts).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }) : '--:--';

export const dataHora = (ts) =>
  ts ? new Date(ts).toLocaleString('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' }) : '--';

/** Número com casas fixas, ou o texto de reserva quando ausente. */
export const num = (v, casas = 1, reserva = '--') =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? reserva : Number(v).toFixed(casas);
