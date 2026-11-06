import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTelemetria } from '../store/useTelemetria.js';
import { useAcaoProtegida } from '../hooks/useAcoes.js';
import { api } from '../lib/api.js';
import { metaRisco, temLeitura } from '../lib/risco.js';
import { hora, num } from '../lib/formato.js';

const TENDENCIA = { elevacao: '▲ Subindo', queda: '▼ Baixando', estavel: '● Estável', indeterminado: '● Aguardando dados' };

function BueiroDetalhado({ bueiro, sigla, modoFisico }) {
  const ok = temLeitura(bueiro);
  const meta = metaRisco(bueiro.risco);
  const cfg = bueiro.calibracao;
  const eletrodos = modoFisico && bueiro.tipoMedicao === 'nivel_percentual' && bueiro.origem === 'Arduino USB';

  return (
    <div className="manhole-card-detailed">
      <div className="manhole-header-tag">
        <div className="flex items-center gap-2">
          <span className="manhole-id-pill">{sigla}</span>
          <div>
            <h2 className="text-sm font-bold text-white">{cfg.nome}</h2>
            <span className="text-xs text-slate-400">{eletrodos ? 'Régua de eletrodos • A0–A5 + GND • Experimental' : modoFisico ? 'Aguardando leitura da régua de eletrodos' : 'Simulação ou monitoramento por telemetria'}</span>
          </div>
        </div>
        <span className={`badge-pill ${ok ? meta.classe : 'muted'}`}>{ok ? meta.rotulo : 'Desconectado'}</span>
      </div>

      <div className="gauge-level-container">
        <div className="text-[11px] uppercase font-bold text-slate-400 mb-1">Nível de Ocupação</div>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-3xl font-extrabold font-mono text-white">{ok ? num(bueiro.nivelPct) : 'Sem leitura disponível'}</span>
          {ok && <span className="text-lg font-bold text-cyan-400">%</span>}
        </div>
        <div className="text-xs mt-1 font-semibold uppercase" style={{ color: ok ? meta.cor : 'var(--text-muted)' }}>
          {ok ? `${meta.rotulo} • ${TENDENCIA[bueiro.tendencia] ?? ''}` : 'Aguardando dados da fonte selecionada'}
        </div>
        <div className="gauge-progress-track">
          <div className="gauge-progress-bar" style={{ width: `${ok ? Math.min(100, bueiro.nivelPct) : 0}%`, backgroundColor: meta.cor }} />
        </div>
      </div>

      <div className="manhole-metrics-grid">
        <div className="metric-sub-card">
          <span className="metric-sub-label">{eletrodos ? 'Tipo de leitura' : 'Distância Medida'}</span>
          <span className="metric-sub-val">{eletrodos ? 'Contatos de água' : ok ? `${num(bueiro.distanciaMedidaCm)} cm` : '-- cm'}</span>
        </div>
        <div className="metric-sub-card">
          <span className="metric-sub-label">Coluna d&apos;Água Útil</span>
          <span className={`metric-sub-val ${sigla === 'B01' ? 'text-cyan-400' : 'text-amber-400'}`}>{ok ? `${num(bueiro.alturaAguaCm)} cm` : '-- cm'}</span>
        </div>
        <div className="metric-sub-card">
          <span className="metric-sub-label">Volume do Reservatório</span>
          <span className="metric-sub-val">{eletrodos ? 'Não calibrado' : ok ? `${bueiro.volumeMl} mL` : '-- mL'}</span>
        </div>
        <div className="metric-sub-card">
          <span className="metric-sub-label">Variação</span>
          <span className="metric-sub-val font-mono text-xs">{ok ? `${num(bueiro.taxaVariacaoMinuto, 2)} %/min` : '--'}</span>
        </div>
      </div>

      <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 flex justify-between">
        <span>Última leitura • {bueiro.origem}</span>
        <span className="font-mono text-white">{ok ? hora(bueiro.timestamp) : '--:--:--'}</span>
      </div>
      <div className="text-[11px] text-slate-400 flex justify-between">
        <span>Coordenadas</span>
        <span className="font-mono text-xs">
          {cfg.coordenadasConfirmadas ? `${cfg.latitude.toFixed(5)}, ${cfg.longitude.toFixed(5)}` : 'Localização não confirmada'}
        </span>
      </div>
    </div>
  );
}

const CAMPOS = [
  ['alturaTotalCm', 'Altura Total (cm)', 0.5],
  ['distanciaCegaCm', 'Zona Cega (cm)', 0.5],
  ['volumeTotalMl', 'Volume Máximo (mL)', 100],
  ['limiteAtencaoPct', 'Limiar Atenção (%)', 5],
  ['limiteCriticoPct', 'Limiar Crítico (%)', 5]
];

const valoresDe = (cfg) => Object.fromEntries(CAMPOS.map(([k]) => [k, cfg[k]]));

function FormCalibracao({ bueiro, cor, titulo, valores, aoMudar }) {
  return (
    <div className="bg-slate-900/60 p-3 rounded border border-slate-800 space-y-2">
      <div className={`font-bold ${cor}`}>{titulo}</div>
      <div className="grid grid-cols-2 gap-2">
        {CAMPOS.map(([k, rotulo, passo]) => (
          <div key={k}>
            <label className="block text-slate-400 text-[10px]" htmlFor={`${bueiro}-${k}`}>{rotulo}</label>
            <input
              id={`${bueiro}-${k}`}
              type="number"
              step={passo}
              className="campo-numero"
              value={valores[k]}
              onChange={(e) => aoMudar(k, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Bueiros() {
  const bueiros = useTelemetria((s) => s.estado?.bueiros || {});
  const fonte = useTelemetria((s) => s.fonteSelecionada);
  const estadoBruto = useTelemetria((s) => s.estadoBruto);
  const definirEstado = useTelemetria((s) => s.definirEstado);
  // Revalida o estado real do servidor mesmo se o WebSocket ficar conectado,
  // mas parar de entregar atualizações. Sem leituras falsas de fallback.
  const { data: snapshotConfirmacao, isError: falhaConsultaEstado } = useQuery({
    queryKey: ['estado-confirmacao-prototipo'],
    queryFn: () => api.get('/estado'),
    enabled: fonte === 'prototipo',
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    retry: 1
  });
  useEffect(() => {
    if (fonte === 'prototipo' && snapshotConfirmacao?.canais) definirEstado(snapshotConfirmacao);
  }, [snapshotConfirmacao, fonte, definirEstado]);
  const simulacaoAtiva = fonte === 'prototipo' && estadoBruto?.modo === 'demo' && estadoBruto?.simulacao?.ativo === true;
  const { data: calibracoesSimuladas, refetch: atualizarCalibracoes } = useQuery({
    queryKey: ['calibracao-simulacao'],
    queryFn: () => api.get('/simulacao/calibracao'),
    enabled: simulacaoAtiva,
    refetchOnWindowFocus: false
  });
  const parametros = simulacaoAtiva ? calibracoesSimuladas?.calibracoes : null;
  const { bueiro_1: b1, bueiro_2: b2 } = bueiros;
  const iniciarSimulacao = () => executarProtegida(async headers => {
    const snapshot = await api.post('/simulacao/iniciar', { cenario: 'chuva_moderada' }, headers);
    if (!snapshot?.simulacao?.ativo || snapshot?.modo !== 'demo') throw new Error('A API não confirmou o início da simulação.');
    definirEstado(snapshot);
    await atualizarCalibracoes();
  }, { sucesso: 'Simulação do protótipo iniciada (dados sintéticos).', beep: 0 });
  const encerrarSimulacao = () => executarProtegida(async headers => {
    const snapshot = await api.post('/simulacao/encerrar', {}, headers);
    if (snapshot?.simulacao?.ativo) throw new Error('A API ainda indica simulação ativa.');
    definirEstado(snapshot);
  }, { sucesso: 'Simulação encerrada. Aguardando leituras físicas.', beep: 0 });
  const { executarProtegida, ocupado } = useAcaoProtegida();

  // Formulário local; volta a refletir o servidor quando a calibração muda lá.
  const cfg1 = parametros?.bueiro_1 || b1?.calibracao;
  const cfg2 = parametros?.bueiro_2 || b2?.calibracao;
  const assinatura = JSON.stringify([cfg1 && valoresDe(cfg1), cfg2 && valoresDe(cfg2)]);
  const [form, setForm] = useState({ assinatura, b1: cfg1 ? valoresDe(cfg1) : {}, b2: cfg2 ? valoresDe(cfg2) : {} });
  if (form.assinatura !== assinatura && !form.editando) {
    setForm({ assinatura, b1: cfg1 ? valoresDe(cfg1) : {}, b2: cfg2 ? valoresDe(cfg2) : {} });
  }

  const mudar = (qual) => (campo, valor) =>
    setForm((f) => ({ ...f, editando: true, [qual]: { ...f[qual], [campo]: valor } }));

  const paraNumeros = (v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(x)]));

  const salvar = () => {
    if (!simulacaoAtiva) return;
    return executarProtegida(async (headers) => {
      await api.put('/simulacao/calibracao/bueiro_1', paraNumeros(form.b1), headers);
      await api.put('/simulacao/calibracao/bueiro_2', paraNumeros(form.b2), headers);
      await atualizarCalibracoes();
      setForm((f) => ({ ...f, editando: false, assinatura: '' }));
    }, { sucesso: 'Parâmetros da simulação atualizados (sem alterar os sensores reais).', beep: 0 });
  };

  const restaurar = () => {
    if (!simulacaoAtiva) return;
    if (!window.confirm('Restaurar somente os parâmetros da simulação?')) return;
    executarProtegida(async (headers) => {
      await api.post('/simulacao/calibracao/restaurar', {}, headers);
      await atualizarCalibracoes();
      setForm((f) => ({ ...f, editando: false, assinatura: '' }));
    }, { sucesso: 'Parâmetros da simulação restaurados.', beep: 0 });
  };

  return (
    <>
      <div className="bueiros-page-grid">
        <BueiroDetalhado bueiro={b1} sigla="B01" modoFisico={fonte === 'prototipo' && !simulacaoAtiva} />
        <BueiroDetalhado bueiro={b2} sigla="B02" modoFisico={fonte === 'prototipo' && !simulacaoAtiva} />
      </div>

      {fonte === 'prototipo' && !simulacaoAtiva && <p className="text-xs text-slate-500">
        Painel preparado para 2 réguas independentes: B01 (A0–A5 + GND) e B02 (entradas adicionais a definir no Arduino). Cada bueiro só recebe nível quando o firmware envia sua própria leitura; sem conexão permanece aguardando.
      </p>}
      {fonte === 'prototipo' && <section className="card-base" aria-label="Estado do teste de simulação">
        <div className="card-header-line">
          <span className="card-title-text">Simulação digital de nível de água</span>
          <strong style={{ color: simulacaoAtiva ? '#16a34a' : '#64748b' }} role="status">
            {simulacaoAtiva ? '● Simulação ativa' : '○ Simulação desligada'}
          </strong>
        </div>
        <p className="text-xs text-slate-300 mb-2">
          Esta simulação cria leituras artificiais no painel. Não aciona a bomba,
          não lê os 7 contatos metálicos e não modifica a placa Arduino.
        </p>
        {falhaConsultaEstado && <p className="text-xs text-amber-500" role="alert">
          Não foi possível consultar o estado atualizado da API. Verifique a conexão com o servidor.
        </p>}
        {simulacaoAtiva && <p className="text-xs text-slate-300">
          Cenário: {estadoBruto?.simulacao?.cenario || 'chuva_moderada'}.
          As curvas e porcentagens exibidas neste modo são dados de demonstração.
        </p>}
        {!simulacaoAtiva && <p className="text-xs text-slate-300">
          Para iniciar, será solicitada a chave de operador (OPERATOR_API_KEY).
          Após a autorização, os indicadores devem mudar para “Simulação ativa”.
        </p>}
        {simulacaoAtiva && <button type="button" className="btn-action-secondary"
          onClick={encerrarSimulacao} disabled={ocupado}>Encerrar simulação digital</button>}
      </section>}
      {fonte === 'prototipo' && !simulacaoAtiva && <div className="card-base">
        <div className="card-header-line"><span className="card-title-text">Parâmetros protegidos</span></div>
        <p className="text-xs text-slate-300 mb-3">A calibração dos sensores físicos é fixa nesta interface. Para testar outros valores sem afetar equipamentos reais, inicie uma simulação do protótipo.</p>
        <button type="button" className="btn-action-secondary" onClick={iniciarSimulacao} disabled={ocupado}>Iniciar simulação de teste</button>
      </div>}
      {simulacaoAtiva && <div className="card-base">
        <div className="card-header-line">
          <span className="card-title-text">⚙️ Parâmetros exclusivos da simulação</span>
          <span className="text-xs text-slate-400 font-mono">H_água = H_total − d_medida</span>
        </div>
        <p className="text-xs text-slate-300 mb-4">
          Ajuste apenas os reservatórios simulados. Estas alterações ficam temporariamente em memória e não modificam a calibração do Arduino nem dos sensores reais.
        </p>

        <div className="grid-2-md text-xs">
          <FormCalibracao bueiro="b1" cor="text-cyan-400" titulo="Bueiro 01 (Entrada)" valores={form.b1} aoMudar={mudar('b1')} />
          <FormCalibracao bueiro="b2" cor="text-amber-400" titulo="Bueiro 02 (Saída)" valores={form.b2} aoMudar={mudar('b2')} />
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
          <button type="button" className="btn-action-secondary" onClick={encerrarSimulacao} disabled={ocupado}>Encerrar simulação</button>
          <button className="btn-action-secondary" onClick={restaurar} disabled={ocupado}>Restaurar Padrões</button>
          <button className="btn-action-primary" onClick={salvar} disabled={ocupado || !calibracoesSimuladas}>Aplicar somente à simulação</button>
        </div>
      </div>}
    </>
  );
}
