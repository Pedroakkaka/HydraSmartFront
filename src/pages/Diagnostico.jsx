import { useState } from 'react';
import { useTelemetria } from '../store/useTelemetria.js';
import { useClima, useSaude } from '../hooks/useConsultas.js';
import { metaRisco, temLeitura } from '../lib/risco.js';
import { dataHora, num } from '../lib/formato.js';
import AnaliseIntegrada from '../components/AnaliseIntegrada.jsx';

function Resumo({ titulo, valor, apoio, classe = '' }) {
  return <article className="diag-summary">
    <span>{titulo}</span><strong className={classe}>{valor}</strong><small>{apoio}</small>
  </article>;
}

export default function Diagnostico() {
  const [detalhes, setDetalhes] = useState(false);
  const estado = useTelemetria(s => s.estado);
  const conexao = useTelemetria(s => s.conexao);
  const fonte = useTelemetria(s => s.fonteSelecionada);
  const { data: clima } = useClima();
  const { data: saude } = useSaude();
  const pontos = Object.entries(estado?.bueiros || {}).filter(([id]) => fonte !== 'prototipo' || estado?.modo === 'demo' || id === 'bueiro_1');
  const validos = pontos.filter(([, b]) => temLeitura(b) && !b.desatualizado);
  const nivel = validos.length ? Math.max(...validos.map(([, b]) => Number(b.nivelPct) || 0)) : null;
  const riscoId = validos.some(([, b]) => b.risco === 'critico') ? 'critico'
    : validos.some(([, b]) => b.risco === 'atencao') ? 'atencao'
    : validos.length ? 'normal' : null;
  const situacao = riscoId ? metaRisco(riscoId).rotulo : 'Indeterminada';
  const serial = estado?.serial;
  const usbLocal = useTelemetria(s => s.usbLocalConectado);
  const prototipo = fonte === 'prototipo';
  const emSimulacao = prototipo && estado?.modo === 'demo';
  const diagnosticos = validos.map(([id,b]) => ({ id, b, diagnostico: b.diagnostico || null }));
  const principal = diagnosticos.find(x => x.id === 'bueiro_1') || diagnosticos[0];
  const diagnostico = principal?.diagnostico;
  const tempo = d => d?.tempoAte100Min === 0 ? 'Limite atingido' : d?.tempoAte100Min != null && d.confiavel ? `${num(d.tempoAte100Min, 1)} min` : 'Não calculável';
  const descricaoFonte = fonte === 'prototipo' ? 'Projeto físico experimental' : 'Análise com dados reais';
  const chuva = clima?.precipitacaoObservadaMm;

  return <div className="diag-simple">
    <div className="diag-intro">
      <div><span className="diag-kicker">HYDRASMART / DIAGNÓSTICO</span>
        <h2>Saúde do monitoramento</h2>
        <p>Leituras, conexões e condições atuais: {descricaoFonte}.</p>
      </div>
      <span className="diag-mode">{descricaoFonte}</span>
    </div>

    <div className="diag-summary-grid">
      <Resumo titulo="Situação dos sensores" valor={situacao} apoio={validos.length ? `${validos.length} pontos com leitura válida` : 'Sem leitura física recente'} classe={riscoId === 'critico' ? 'diag-danger' : riscoId === 'atencao' ? 'diag-warning' : 'diag-blue'} />
      <Resumo titulo="Maior nível medido" valor={nivel === null ? '—' : `${num(nivel)}%`} apoio={nivel === null ? 'Aguardando sensores' : 'Maior leitura válida'} />
      <Resumo titulo="Conexão do servidor" valor={conexao === 'online' ? 'Tempo real' : saude?.status === 'ok' ? 'API disponível' : 'Verificando'} apoio={conexao === 'online' ? 'WebSocket conectado' : 'Canal em tempo real indisponível'} />
      {prototipo && !emSimulacao ? <Resumo titulo="Tempo até o máximo · bancada" valor={tempo(diagnostico)} apoio={diagnostico?.motivo || 'Aguardando amostras da régua de contatos'} /> : <Resumo titulo="Chuva observada" valor={chuva == null ? '—' : `${num(chuva, 1)} mm`} apoio="Fonte meteorológica Open-Meteo" />}
    </div>

    {prototipo && !emSimulacao && <section className="diag-panel" aria-label="Diagnóstico de subida da água em tempo real">
      <div className="diag-section-header"><h3>↗ Diagnóstico da régua de nível · tempo real</h3><span>Dados experimentais do Arduino</span></div>
      <div className="diag-health-grid">
        <div><span>Nível atual</span><strong>{principal ? `${num(principal.b.nivelPct, 1)}%` : 'Sem leitura'}</strong></div>
        <div><span>Velocidade de variação</span><strong>{diagnostico?.taxaPctMin != null ? `${num(diagnostico.taxaPctMin, 2)} %/min` : 'Não calculada'}</strong></div>
        <div><span>Tendência</span><strong>{diagnostico?.tendencia || 'Indeterminada'}</strong></div>
        <div><span>Tempo estimado até 100%</span><strong>{tempo(diagnostico)}</strong></div>
        <div><span>Amostras analisadas</span><strong>{diagnostico?.amostras ?? 0}</strong></div>
        <div><span>Qualidade da estimativa</span><strong>{diagnostico?.confiavel ? 'Estimativa experimental' : 'Ainda insuficiente'}</strong></div>
      </div>
      <p className="hydra-muted" role="status">{diagnostico?.motivo || 'Aguardando amostras reais do Arduino. Nenhuma estimativa sem leituras recentes.'}</p>
      <p className="hydra-muted">Percentuais derivados dos contatos metálicos. Estimativa linear aproximada, não previsão validada de alagamento urbano; a vazão da bomba pode variar.</p>
    </section>}

    <section className="diag-panel">
      <div className="diag-section-header"><h3>◉ Sensores monitorados</h3><span>{validos.length} de {pontos.length} com dados atuais</span></div>
      <div className="diag-sensors">
        {pontos.map(([id, b]) => {
          const atual = temLeitura(b) && !b.desatualizado;
          return <div className="diag-sensor" key={id}>
            <div><strong>{b.nome || id.replaceAll('_', ' ').toUpperCase()}</strong><small>{atual ? 'Leitura disponível' : 'Aguardando medição'}</small></div>
            <div className="diag-sensor-value">{atual ? `${num(b.nivelPct)}%` : '—'}</div>
            <span className={`badge-pill ${atual ? metaRisco(b.risco).classe : 'muted'}`}>{atual ? metaRisco(b.risco).rotulo : 'Sem dados'}</span>
          </div>;
        })}
        {!pontos.length && <p className="diag-empty">Aguardando o estado inicial dos sensores.</p>}
      </div>
    </section>

    <section className="diag-panel">
      <div className="diag-section-header"><h3>▤ Estado técnico</h3><span>Informações essenciais</span></div>
      <div className="diag-health-grid">
        <div><span>Banco de dados</span><strong>{saude?.banco ?? 'Consultando…'}</strong></div>
        <div><span>Arduino / serial</span><strong>{prototipo ? (usbLocal ? 'USB local conectada' : 'USB local não conectada neste navegador') : (serial?.habilitada ? (serial.conectado ? 'Conectado ao servidor' : 'Desconectado') : 'Desativado no servidor')}</strong></div>
        <div><span>Origem selecionada</span><strong>{descricaoFonte}</strong></div>
      </div>
      <button type="button" className="diag-details-button" onClick={() => setDetalhes(v => !v)} aria-expanded={detalhes}>
        {detalhes ? 'Ocultar informações técnicas −' : 'Ver informações técnicas +'}
      </button>
      {detalhes && <div className="diag-extra">
        {pontos.map(([id,b]) => <div key={id}>
          <h4>{b.nome || id.replaceAll('_', ' ')}</h4>
          <p>Origem: {b.origem || 'Não informada'} · Última leitura: {b.timestamp ? dataHora(b.timestamp) : 'Não recebida'}</p>
          <p>{b.tipoMedicao === 'nivel_percentual' ? 'Régua de contatos (sem altura calibrada)' : `Altura: ${temLeitura(b) ? `${num(b.alturaAguaCm)} cm` : 'Sem leitura'}`} · Tendência: {b.diagnostico?.tendencia || b.tendencia || 'Não informada'}</p>
        </div>)}
        <p>Previsões de enchimento e probabilidades de alagamento não estão validadas. A ausência de leituras não indica normalidade.</p>
      </div>}
    </section>

    <AnaliseIntegrada bueiros={estado?.bueiros || {}} demonstracao={prototipo} />
    {prototipo && <p className="hydra-muted">Leituras da bancada ou cenário digital não representam níveis reais de drenagem urbana. Nenhum aviso oficial é enviado.</p>}
  </div>;
}
