import { useEffect, useState } from 'react';

const formatar = () => new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba' });

/** Hora oficial de Cáceres-MT (GMT-4), atualizada a cada segundo. */
export function useRelogio() {
  const [agora, setAgora] = useState(formatar);
  useEffect(() => {
    const id = setInterval(() => setAgora(formatar()), 1000);
    return () => clearInterval(id);
  }, []);
  return agora;
}
