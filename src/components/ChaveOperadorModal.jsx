import { useEffect, useRef, useState } from 'react';
import { responderPedidoChave, useOperador } from '../store/useOperador.js';

/** Janela que pede a chave do operador quando uma ação protegida é executada. */
export default function ChaveOperadorModal() {
  const pedido = useOperador((s) => s.pedido);
  if (!pedido) return null;
  // `key` recria o formulário a cada pedido, limpando o campo.
  return <FormularioChave key={pedido.mensagem ?? 'novo'} mensagem={pedido.mensagem} />;
}

function FormularioChave({ mensagem }) {
  const [valor, setValor] = useState('');
  const campo = useRef(null);

  useEffect(() => {
    campo.current?.focus();
    const aoTeclar = (e) => { if (e.key === 'Escape') responderPedidoChave(null); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  const confirmar = (e) => {
    e.preventDefault();
    if (valor.trim()) responderPedidoChave(valor);
  };

  return (
    <div className="modal-fundo" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) responderPedidoChave(null); }}>
      <form className="modal-caixa" role="dialog" aria-modal="true" aria-labelledby="titulo-chave" onSubmit={confirmar}>
        <h2 id="titulo-chave" className="text-sm font-bold text-white">🔐 Chave do operador</h2>
        <p className="text-xs text-slate-300">
          Esta ação altera o sistema. Informe a chave do operador, que aparece na janela do
          <b> INICIAR-HYDRASMART</b> e na linha <code>OPERATOR_API_KEY</code> do arquivo <code>.env</code> da API.
        </p>
        {mensagem && <div className="modal-erro">{mensagem}</div>}
        <input
          ref={campo}
          type="password"
          className="campo-numero"
          autoComplete="off"
          placeholder="Chave do operador"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-label="Chave do operador"
        />
        <p className="text-[11px] text-slate-400">A chave fica guardada só até a página ser recarregada.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-action-secondary text-xs" onClick={() => responderPedidoChave(null)}>Cancelar</button>
          <button type="submit" className="btn-action-primary text-xs" disabled={!valor.trim()}>Confirmar</button>
        </div>
      </form>
    </div>
  );
}
