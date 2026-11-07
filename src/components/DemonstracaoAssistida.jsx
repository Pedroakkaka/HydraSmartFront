import { useState } from 'react';
import { useHistoricoOficial } from '../hooks/useConsultas.js';

const FASES = [
  { titulo: '1. Registro documentado', descricao: 'O HydraSmart consulta o documento ou registro histórico e identifica a fonte e o período da ocorrência.' },
  { titulo: '2. Análise contextual', descricao: 'O sistema apresenta o contexto documentado. Sem série temporal ou critérios validados, não atribui probabilidade nem prevê alagamentos.' },
  { titulo: '3. Prévia de ocorrência', descricao: 'O HydraSmart demonstra como reuniria os dados para uma ocorrência. Trata-se de uma prévia local, sem envio à Defesa Civil ou a celulares.' }
];

export default function DemonstracaoAssistida() {
  const { data, isLoading, isError } = useHistoricoOficial();
  const eventos = Array.isArray(data) ? data : [];
  const [eventoSelecionado, setEventoSelecionado] = useState('');
  const [fase, setFase] = useState(0);
  const evento = eventos.find(item => String(item.id) === String(eventoSelecionado)) || eventos[0];
  const mudarEvento = (id) => { setEventoSelecionado(id); setFase(0); };
  return <section className="hs-card hs-replay" aria-label="Demonstração assistida a partir de registros históricos">
    <div className="hs-card-head">
      <h3><span className="hs-outline-icon">▤</span> Reproduzir evento histórico</h3>
      <span className="hs-replay-badge">SIMULAÇÃO DO PROCESSO · REGISTROS REAIS</span>
    </div>
    <p className="hs-card-foot hs-replay-intro">Explore as etapas de análise de uma ocorrência documentada. Os registros são reais; a sequência de operação é apenas demonstrativa.</p>
    {isLoading && <p className="hydra-muted">Consultando o acervo oficial…</p>}
    {isError && <p className="hydra-muted">Os registros não estão disponíveis neste momento.</p>}
    {evento ? <>
      <label className="hs-replay-label" htmlFor="hs-evento-historico">Evento documentado</label>
      <select id="hs-evento-historico" className="hs-replay-select" value={eventoSelecionado || String(evento.id)}
        onChange={e => mudarEvento(e.target.value)}>
        {eventos.map(item => <option key={item.id} value={String(item.id)}>{item.data} · {item.titulo}</option>)}
      </select>
      <div className="hs-replay-record">
        <strong>{evento.titulo}</strong>
        <small>Data: {evento.data || 'Não informada'} · Órgão: {evento.orgaoResponsavel || 'Não informado'}</small>
        <p>{evento.descricaoOficial || 'Descrição oficial indisponível.'}</p>
        {evento.linkConsulta && <a href={evento.linkConsulta} target="_blank" rel="noreferrer">Consultar o registro original ↗</a>}
      </div>
      <div className="hs-replay-steps">
        {FASES.map((etapa, indice) => <button type="button" key={etapa.titulo}
          className={`hs-replay-step ${fase === indice ? 'selected' : ''}`}
          onClick={() => setFase(indice)} aria-pressed={fase === indice}>{indice + 1}</button>)}
      </div>
      <div className="hs-replay-phase" aria-live="polite">
        <strong>{FASES[fase].titulo}</strong>
        <p>{FASES[fase].descricao}</p>
        {fase === 2 && <div className="hs-replay-preview">
          <span>PRÉVIA INTERNA · NÃO ENVIADA</span>
          <p><b>Assunto:</b> Avaliação de ocorrência histórica: {evento.titulo}</p>
          <p><b>Fonte:</b> {evento.orgaoResponsavel || 'Registro consultado'} · {evento.data}</p>
          <p><b>Situação:</b> reprodução didática; nenhuma emergência atual inferida</p>
        </div>}
      </div>
      <div className="hs-replay-actions">
        <button type="button" className="hs-text-link" onClick={() => setFase(v => (v + 1) % FASES.length)}>
          {fase === FASES.length - 1 ? 'Reiniciar apresentação ↺' : 'Próxima etapa →'}
        </button>
        <span>Não gera nem encaminha alertas.</span>
      </div>
    </> : !isLoading && <p className="hydra-muted">Nenhum evento histórico disponível para reprodução.</p>}
  </section>;
}
