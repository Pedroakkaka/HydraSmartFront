import { useNavigate } from 'react-router-dom';
import { useTelemetria } from '../store/useTelemetria.js';
import { useClima, useSaude, useHistoricoOficial } from '../hooks/useConsultas.js';
import { metaRisco, situacaoGeral, temLeitura } from '../lib/risco.js';
import { num } from '../lib/formato.js';
import AnaliseIntegrada from '../components/AnaliseIntegrada.jsx';

function BueiroResumo({ bueiro, numero, onClick }) {
  const valido = temLeitura(bueiro) && !bueiro.desatualizado;
  const risco = valido ? metaRisco(bueiro.risco).rotulo : 'Sem leitura';
  const percentual = valido ? Math.max(0, Math.min(100, Number(bueiro.nivelPct) || 0)) : 0;
  return (
    <div className="hydra-panel">
      <div className="card-header-line">
        <h3>◉ Bueiro {numero} · {numero === '01' ? 'Entrada' : 'Saída'}</h3>
        <span className={`badge-pill ${valido ? metaRisco(bueiro.risco).classe : 'muted'}`}>{risco}</span>
      </div>
      <div className="hydra-number">{valido ? `${num(bueiro.nivelPct)}%` : '—'}</div>
      <p className="hydra-muted">{valido ? `${num(bueiro.alturaAguaCm)} cm de coluna d’água` : 'Aguardando medição do sensor físico.'}</p>
      <div className="hydra-level-track" aria-label={valido ? `Nível ${percentual}%` : 'Sem medição'}>
        <div className="hydra-level-fill" style={{ width: `${percentual}%` }} />
      </div>
      <div className="hydra-mini-meta">
        <span>{valido ? `Atenção: ${bueiro.calibracao.limiteAtencaoPct}%` : 'Leitura indisponível'}</span>
        <button type="button" className="hydra-link" onClick={onClick}>Detalhes ↗</button>
      </div>
    </div>
  );
}

export default function VisaoGeral() {
  const navegar = useNavigate();
  const estado = useTelemetria((s) => s.estado);
  const conexao = useTelemetria((s) => s.conexao);
  const { data: clima } = useClima();
  const { data: historico } = useHistoricoOficial();
  const { data: saude } = useSaude();
  if (!estado?.bueiros?.bueiro_1 || !estado?.bueiros?.bueiro_2) return <p className="hydra-muted">Aguardando estado dos sensores…</p>;
  const b1 = estado.bueiros.bueiro_1;
  const b2 = estado.bueiros.bueiro_2;
  const situacao = situacaoGeral(estado.bueiros);
  const temAmbos = [b1,b2].every((b) => temLeitura(b) && !b.desatualizado);
  const estatus = !temAmbos ? 'Sem leituras' : situacao === 'normal' ? 'Operacional' : situacao === 'atencao' ? 'Atenção' : situacao === 'critico' ? 'Crítico' : 'Indeterminado';
  const classe = !temAmbos ? '' : situacao === 'normal' ? 'ok' : situacao === 'atencao' ? 'warn' : situacao === 'critico' ? 'danger' : '';
  const chuva = clima?.precipitacaoObservadaMm;

  return (
    <div className="hydra-dashboard">
      <div className="hydra-dashboard-main">
        <div className="hydra-kpis">
          <div className="hydra-kpi hydra-kpi-feature">
            <h3>◉ Status do monitoramento</h3>
            <span className={`hydra-state ${classe}`}>{estatus}</span>
            <p className="hydra-banner-hint">{!temAmbos ? 'Sensores sem leituras recentes; situação não determinada.' : 'Situação dos sensores físicos monitorados.'}</p>
          </div>
          <div className="hydra-kpi">
            <h3>◷ Tempo até extravasamento</h3>
            <strong>Não disponível</strong>
            <small>Estimativa hidráulica ainda não validada.</small>
          </div>
          <div className="hydra-kpi">
            <h3>△ Probabilidade de alagamento</h3>
            <strong>Não disponível</strong>
            <small>O sistema não realiza previsão validada.</small>
          </div>
        </div>

        <div className="hydra-info-pair">
          <div className="hydra-panel">
            <div className="card-header-line"><h3>◉ Nível de água dos sensores</h3><button type="button" onClick={() => navegar('/bueiros')} className="hydra-link">Ver sensores ↗</button></div>
            <div className="hydra-number">{temLeitura(b1) && !b1.desatualizado ? `${num(b1.alturaAguaCm)} cm` : 'Sem leitura'}</div>
            <p className="hydra-muted">Bueiro 01 · medição do protótipo físico, não nível do Guaíba.</p>
            <div className="hydra-level-track"><div className="hydra-level-fill" style={{ width: `${temLeitura(b1) && !b1.desatualizado ? Math.min(100,Math.max(0,Number(b1.nivelPct)||0)) : 0}%` }} /></div>
            <div className="hydra-mini-meta"><span>Sensor 01: {temLeitura(b1) && !b1.desatualizado ? 'com leitura' : 'sem dados'}</span><span>Sensor 02: {temLeitura(b2) && !b2.desatualizado ? 'com leitura' : 'sem dados'}</span></div>
          </div>
          <div className="hydra-panel">
            <div className="card-header-line"><h3>☁ Precipitação observada</h3><button type="button" className="hydra-link" onClick={() => navegar('/clima')}>Clima ↗</button></div>
            <div className="hydra-number">{chuva == null ? 'Sem dados' : `${num(chuva,1)} mm`}</div>
            <p className="hydra-muted">Fonte: Open-Meteo · valor conforme período informado pela API.</p>
            <div className="hydra-data-grid" style={{marginTop:12}}>
              <div><span>Temperatura</span><strong>{clima?.temperatura == null ? '—' : `${num(clima.temperatura)} °C`}</strong></div>
              <div><span>Umidade</span><strong>{clima?.umidadeRelativaPct == null ? '—' : `${clima.umidadeRelativaPct}%`}</strong></div>
            </div>
          </div>
        </div>

        <div className="hydra-info-pair">
          <BueiroResumo bueiro={b1} numero="01" onClick={() => navegar('/bueiros')} />
          <BueiroResumo bueiro={b2} numero="02" onClick={() => navegar('/bueiros')} />
        </div>

        <div className="hydra-panel">
          <div className="card-header-line">
            <h3>↗ Evolução dos níveis</h3>
            <button type="button" className="hydra-link" onClick={() => navegar('/graficos')}>Abrir gráficos e histórico ↗</button>
          </div>
          <div className="hydra-chart-empty">{b1.historicoNiveis?.length || b2.historicoNiveis?.length
            ? 'As séries reais dos sensores estão disponíveis na página Gráficos e histórico.'
            : 'Nenhuma série de medição física disponível. O gráfico será exibido quando chegarem leituras.'}</div>
        </div>

        <div className="hydra-panel">
          <div className="card-header-line"><h3>▤ Fontes e integridade dos dados</h3><button className="hydra-link" type="button" onClick={() => navegar('/diagnostico')}>Diagnóstico ↗</button></div>
          <div className="hydra-data-grid">
            <div><span>API / Tempo real</span><strong>{conexao === 'online' ? 'Conectado' : 'HTTP disponível / WS pendente'}</strong></div>
            <div><span>Banco de dados</span><strong>{saude?.banco ?? 'Consultando…'}</strong></div>
            <div><span>Leitura serial</span><strong>{estado.serial?.habilitada ? estado.serial?.conectado ? 'Conectada' : 'Desconectada' : 'Desativada'}</strong></div>
            <div><span>Referências oficiais</span><strong>{Array.isArray(historico) ? historico.length : '—'}</strong></div>
          </div>
          <p className="hydra-ai-footnote">Dados externos, sensores físicos e análises de IA têm origens distintas. Ausência de medição não significa situação normal.</p>
          <button type="button" className="btn-action-primary" style={{marginTop:13}} onClick={() => navegar('/mapa')}>⌖ Explorar mapa de Porto Alegre ↗</button>
        </div>
      </div>
      <AnaliseIntegrada />
    </div>
  );
}
