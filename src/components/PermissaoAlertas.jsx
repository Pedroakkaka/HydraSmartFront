import { useEffect } from 'react';
import { useNotificacoesTeste } from '../lib/notificacoesTeste.js';
import { inscreverCelular, suportaPushRemoto } from '../lib/pushRemoto.js';

/**
 * Gerenciamento invisível: o visitante recebe o convite de autorização
 * na entrada, mas não precisa procurar botões de teste ou de ativação.
 * Depois do opt-in a inscrição Push é renovada automaticamente.
 */
export default function PermissaoAlertas() {
  const inscrito = useNotificacoesTeste(s => s.inscrito);
  const definirPush = useNotificacoesTeste(s => s.definirPush);
  const pushAtivo = useNotificacoesTeste(s => s.pushAtivo);

  useEffect(() => {
    if (!inscrito || !suportaPushRemoto() ||
        Notification.permission !== 'granted' || pushAtivo) return;
    let ativo = true;
    inscreverCelular().then(() => {
      if (ativo) definirPush(true);
    }).catch(err => {
      if (ativo) definirPush(false, err.message);
    });
    return () => { ativo = false; };
  }, [inscrito, pushAtivo, definirPush]);

  return null;
}
