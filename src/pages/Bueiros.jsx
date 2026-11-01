import { useState } from 'react';
import { useTelemetria } from '../store/useTelemetria.js';
import { useAcaoProtegida } from '../hooks/useAcoes.js';
import { api } from '../lib/api.js';
import { metaRisco, temLeitura } from '../lib/risco.js';
import { hora, num } from '../lib/formato.js';

const TENDENCIA = { elevacao: '▲ Subindo', queda: '▼ Baixando', estavel: '● Estável', indeterminado: '● Aguardando dados' };

function BueiroDetalhado({ bueiro, sigla }) {
  const ok = temLeitura(bueiro);
  const meta = metaRisco(bueiro.risco);
  const cfg = bueiro.calibracao;

  return (
    <div className="manhole-card-detailed">
      <div className="manhole-header-tag">
        <div className="flex items-center gap-2">
          <span className="manhole-id-pill">{sigla}</span>
          <div>
            <h2 className="text-sm font-bold text-white">{cfg.nome}</h2>
            <span className="text-xs text-slate-400">Sensor Ultrassônico HC-SR04 • TRIG {cfg.pinoTrig} / ECHO {cfg.pinoEcho}</span>
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
          {ok ? `${meta.rotulo} • ${TENDENCIA[bueiro.tendencia] ?? ''}` : 'Aguardando leituras do sensor'}
        </div>
        <div className="gauge-progress-track">
          <div className="gauge-progress-bar" style={{ width: `${ok ? Math.min(100, bueiro.nivelPct) : 0}%`, backgroundColor: meta.cor }} />
        </div>
      </div>

      <div className="manhole-metrics-grid">
        <div className="metric-sub-card">
          <span className="metric-sub-label">Distância Medida</span>
          <span className="metric-sub-val">{ok ? `${num(bueiro.distanciaMedidaCm)} cm` : '-- cm'}</span>
        </div>
        <div className="metric-sub-card">
          <span className="metric-sub-label">Coluna d&apos;Água Útil</span>
          <span className={`metric-sub-val ${sigla === 'B01' ? 'text-cyan-400' : 'text-amber-400'}`}>{ok ? `${num(bueiro.alturaAguaCm)} cm` : '-- cm'}</span>
        </div>
        <div className="metric-sub-card">
          <span className="metric-sub-label">Volume do Reservatório</span>
          <span className="metric-sub-val">{ok ? `${bueiro.volumeMl} mL` : '-- mL'}</span>
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
  const bueiros = useTelemetria((s) => s.estado.bueiros);
  const { bueiro_1: b1, bueiro_2: b2 } = bueiros;
  const { executarProtegida, ocupado } = useAcaoProtegida();

  // Formulário local; volta a refletir o servidor quando a calibração muda lá.
  const assinatura = JSON.stringify([valoresDe(b1.calibracao), valoresDe(b2.calibracao)]);
  const [form, setForm] = useState({ assinatura, b1: valoresDe(b1.calibracao), b2: valoresDe(b2.calibracao) });
  if (form.assinatura !== assinatura && !form.editando) {
    setForm({ assinatura, b1: valoresDe(b1.calibracao), b2: valoresDe(b2.calibracao) });
  }

  const mudar = (qual) => (campo, valor) =>
    setForm((f) => ({ ...f, editando: true, [qual]: { ...f[qual], [campo]: valor } }));

  const paraNumeros = (v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(x)]));

  const salvar = () =>
    executarProtegida(async (headers) => {
      await api.put('/bueiros/bueiro_1/calibracao', paraNumeros(form.b1), headers);
      await api.put('/bueiros/bueiro_2/calibracao', paraNumeros(form.b2), headers);
      setForm((f) => ({ ...f, editando: false, assinatura: '' }));
    }, { sucesso: 'Calibração salva no servidor e aplicada às próximas leituras.', beep: 1000 });

  const restaurar = () => {
    if (!window.confirm('Restaurar as dimensões e limiares padrão dos dois bueiros?')) return;
    executarProtegida(async (headers) => {
      await api.post('/bueiros/calibracao/restaurar', {}, headers);
      setForm((f) => ({ ...f, editando: false, assinatura: '' }));
    }, { sucesso: 'Calibração padrão restaurada.', beep: 600 });
  };

  return (
    <>
      <div className="bueiros-page-grid">
        <BueiroDetalhado bueiro={b1} sigla="B01" />
        <BueiroDetalhado bueiro={b2} sigla="B02" />
      </div>

      <div className="card-base">
        <div className="card-header-line">
          <span className="card-title-text">⚙️ Parâmetros de Calibração Dimensional dos Reservatórios</span>
          <span className="text-xs text-slate-400 font-mono">H_água = H_total − d_medida</span>
        </div>
        <p className="text-xs text-slate-300 mb-4">
          Ajuste as dimensões reais dos reservatórios do protótipo. O servidor calcula a coluna d&apos;água útil
          descontando a zona cega do sensor e usa os limiares abaixo para classificar o risco e disparar alertas.
        </p>

        <div className="grid-2-md text-xs">
          <FormCalibracao bueiro="b1" cor="text-cyan-400" titulo="Bueiro 01 (Entrada)" valores={form.b1} aoMudar={mudar('b1')} />
          <FormCalibracao bueiro="b2" cor="text-amber-400" titulo="Bueiro 02 (Saída)" valores={form.b2} aoMudar={mudar('b2')} />
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
          <button className="btn-action-secondary" onClick={restaurar} disabled={ocupado}>Restaurar Padrões</button>
          <button className="btn-action-primary" onClick={salvar} disabled={ocupado}>Salvar Parâmetros</button>
        </div>
      </div>
    </>
  );
}
