import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { cabecalhoOperador } from '../lib/operador.js';
import { avisar, useTelemetria } from '../store/useTelemetria.js';

const OPCOES = [
  { id: 'prototipo', titulo: 'Projeto físico', tag: 'BANCADA EXPERIMENTAL', icone: '⌁',
    descricao: 'Acompanhar as leituras dos sensores reais do projeto físico. Sem dados artificiais.' },
  { id: 'inteligente', titulo: 'Análise com dados reais', tag: 'OBSERVAÇÕES REAIS + DEMONSTRAÇÃO ASSISTIDA', icone: '⌖',
    descricao: 'Analisar medições oficiais e de campo e demonstrar o fluxo de alertas usando eventos documentados.' }
];

export const ROTULOS_FONTE = {
  prototipo: 'Protótipo físico · Experimental',
  inteligente: 'Monitoramento inteligente · Dados reais'
};

export default function SeletorModo({ aberto, fechar }) {
  const atual = useTelemetria(s => s.fonteSelecionada);
  const selecionarFonte = useTelemetria(s => s.selecionarFonte);
  const modoApi = useTelemetria(s => s.estadoBruto?.modo);
  const [escolha, setEscolha] = useState(atual);
  const [chave, setChave] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    setEscolha(atual);
    setChave('');
    setErro('');
    inputRef.current?.focus();
  }, [aberto, atual]);

  useEffect(() => {
    if (!aberto) return;
    const keydown = e => { if (e.key === 'Escape' && !ocupado) fechar(); };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [aberto, fechar, ocupado]);

  const aplicar = async e => {
    e.preventDefault();
    const headers = cabecalhoOperador(chave);
    if (!headers) { setErro('Informe a chave de acesso.'); return; }
    setOcupado(true);
    setErro('');
    try {
      // Mesmo trocar apenas a visualização exige credencial validada no servidor.
      await api.get('/operador/validar', headers);
      // O modo fictício legado não participa dos dois modos atuais.
      // Se havia cenário ativo, encerramos antes da mudança de contexto.
      if (modoApi === 'demo') {
        await api.post('/simulacao/encerrar', {}, headers);
      }
      selecionarFonte(escolha);
      setChave('');
      avisar(`Fonte selecionada: ${ROTULOS_FONTE[escolha]}`);
      fechar();
    } catch (e) {
      setErro(e.message || 'Não foi possível selecionar este modo.');
    } finally {
      setOcupado(false);
    }
  };

  if (!aberto) return null;
  return (
    <div className="hs-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !ocupado) fechar(); }}>
      <section className="hs-modal" role="dialog" aria-modal="true" aria-labelledby="hs-modal-titulo">
        <header className="hs-modal-head">
          <div><span>CONFIGURAÇÃO DO MONITORAMENTO</span><h2 id="hs-modal-titulo">Selecionar modo de operação</h2><p>Selecione a experiência de monitoramento. Nenhum modo gera alerta externo.</p></div>
          <button type="button" onClick={fechar} disabled={ocupado} aria-label="Fechar janela">✕</button>
        </header>
        <form onSubmit={aplicar}>
          <div className="hs-modal-options">
            {OPCOES.map(o => (
              <label className={`hs-modal-option ${escolha === o.id ? 'selected' : ''}`} key={o.id}>
                <input type="radio" name="fonte" value={o.id} checked={escolha === o.id} onChange={() => setEscolha(o.id)} disabled={ocupado}/>
                <span className="hs-modal-option-icon">{o.icone}</span>
                <span className="hs-modal-option-text"><strong>{o.titulo}</strong><small>{o.tag}</small><span>{o.descricao}</span></span>
                <span className="hs-modal-check">{escolha === o.id ? '✓' : ''}</span>
              </label>
            ))}
          </div>
          <div className="hs-modal-credentials">
            <label htmlFor="hs-chave">Chave de acesso do operador</label>
            <input ref={inputRef} id="hs-chave" type="password" value={chave} onChange={e => setChave(e.target.value)} autoComplete="off" placeholder="Digite a chave para confirmar" disabled={ocupado} required />
            <small>A chave é verificada pela API e não é armazenada no navegador.</small>
            {erro && <p role="alert" className="hs-modal-error">{erro}</p>}
          </div>
          <div className="hs-modal-actions">
            <button type="button" onClick={fechar} disabled={ocupado}>Cancelar</button>
            <button type="submit" disabled={ocupado || !chave.trim()}>{ocupado ? 'Verificando…' : 'Confirmar e trocar modo'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
