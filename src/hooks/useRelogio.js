import { useEffect, useState } from 'react';
import { FUSO } from '../lib/formato.js';

const formatar = () => new Date().toLocaleTimeString('pt-BR', { timeZone: FUSO });

/** Hora oficial de Porto Alegre-RS (GMT-3), atualizada a cada segundo. */
export function useRelogio() {
  const [agora, setAgora] = useState(formatar);
  useEffect(() => {
    const id = setInterval(() => setAgora(formatar()), 1000);
    return () => clearInterval(id);
  }, []);
  return agora;
}
