import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useTelemetria } from '../store/useTelemetria.js';
import { useCemaden, useClima, useSaude } from '../hooks/useConsultas.js';
import { metaRisco, situacaoGeral, temLeitura } from '../lib/risco.js';
import { hora, num } from '../lib/formato.js';
import { useRelogio } from '../hooks/useRelogio.js';

const CENTRO_PORTO_ALEGRE = [-30.0346, -51.2177];

const SITUACAO = {
  critico: {
    badge: ['danger', 'Alerta Crítico'], valor: ['text-rose-500', 'Crítico'], card: 'active-alert',
    icone: ['bg-rose-500 text-white', '⚠'], titulo: 'Risco Iminente de Transbordo',
    descricao: "Nível d'água acima do limiar crítico em galeria monitorada."
  },
  atencao: {
    badge: ['warning', 'Atenção'], valor: ['text-amber-400', 'Atenção'], card: '',
    icone: ['bg-amber-500 text-black', '!'], titulo: 'Elevação do Nível de Drenagem',
    descricao: "Nível d'água entre os limiares de atenção e crítico nas galerias monitoradas."
  },
  normal: {
    badge: ['normal', 'Operacional'], valor: ['text-emerald-400', 'Normal'], card: '',
    icone: ['bg-emerald-500 text-white', '✓'], titulo: 'Condição Hidrológica Normal',
    descricao: 'Nenhum transbordo ou risco crítico detectado nas galerias monitoradas.'
  }
};

function CardBueiro({ bueiro, titulo, onClick }) {
  const ok = temLeitura(bueiro);
  const meta = metaRisco(bueiro.risco);
  const cfg = bueiro.calibracao;

  return (
    <div className="card-base cursor-pointer" onClick={onClick}>
      <div className="card-header-line">
        <span className="card-title-text">{titulo}</span>
        <span className={`badge-pill ${ok ? meta.classe : 'muted'}`}>{ok ? meta.rotulo : 'Desconectado'}</span>
      </div>
      <div className="card-value-display">
        <span className="value-large">{ok ? `${num(bueiro.nivelPct)}%` : 'Sem leitura'}</span>
        <span className="value-unit">{ok ? `(${num(bueiro.alturaAguaCm)} cm d'água)` : ''}</span>
      </div>
      <div className="card-meta-text">
        <span>
          {!ok ? 'Aguardando leituras' : bueiro.desatualizado ? '⚠️ Desatualizado' : `Distância: ${num(bueiro.distanciaMedidaCm)} cm`}
        </span>
        <span className="font-mono">{ok ? hora(bueiro.timestamp) : '--:--'}</span>
      </div>
      <div className={`text-[10px] font-mono mt-1 ${cfg.coordenadasConfirmadas ? 'text-emerald-400' : 'text-slate-500'}`}>
        {cfg.coordenadasConfirmadas
          ? `Lat: ${cfg.latitude.toFixed(4)}, Lng: ${cfg.longitude.toFixed(4)}`
          : 'Localização não confirmada'}
      </div>
    </div>
  );
}

function statusCemaden(c) {
  if (!c) return ['text-slate-400', 'Consultando...'];
  if (c.status === 'sucesso') return ['text-emerald-400', 'Estações de Porto Alegre com dados recentes'];
  if (c.status === 'sem_dados_recentes') return ['text-amber-400', 'Sem dados recentes'];
  if (c.status === 'sem_token') return ['text-slate-400', 'Sem token configurado'];
  return ['text-rose-400', 'Falha de conexão'];
}

export default function VisaoGeral() {
  const navegar = useNavigate();
  const relogio = useRelogio();
  const estado = useTelemetria((s) => s.estado);
  const { data: clima } = useClima();
  const { data: cemaden } = useCemaden();
  const saude = useSaude();

  const { bueiro_1: b1, bueiro_2: b2 } = estado.bueiros;
  const s = SITUACAO[situacaoGeral(estado.bueiros)];
  const serial = estado.serial;
  const [corCemaden, textoCemaden] = statusCemaden(cemaden);
  const banco = saude.data?.banco ?? (saude.isError ? 'indisponível' : '...');

  const abrirBueiro = () => navegar('/bueiros');

  return (
    <>
      <div className="overview-grid">
        <div className="card-base">
          <div className="card-header-line">
            <span className="card-title-text">Sistema Geral</span>
            <span className={`badge-pill ${s.badge[0]}`}>{s.badge[1]}</span>
          </div>
          <div className="card-value-display">
            <span className={`value-large ${s.valor[0]}`}>{s.valor[1]}</span>
          </div>
          <div className="card-meta-text">
            <span>Porto Alegre - Rio Grande do Sul</span>
            <span>{relogio} (GMT-3)</span>
          </div>
        </div>

        <CardBueiro bueiro={b1} titulo="Bueiro 01 (Entrada)" onClick={abrirBueiro} />
        <CardBueiro bueiro={b2} titulo="Bueiro 02 (Saída)" onClick={abrirBueiro} />

        <div className="card-base cursor-pointer" onClick={() => navegar('/clima')}>
          <div className="card-header-line">
            <span className="card-title-text">Clima (Open-Meteo)</span>
            <span className="text-xs text-cyan-400 font-mono">{clima?.condicaoTempo ?? 'Consultando...'}</span>
          </div>
          <div className="card-value-display">
            <span className="value-large">{num(clima?.temperatura)}</span>
            <span className="value-unit">°C</span>
          </div>
          <div className="card-meta-text">
            <span>Chuva: {num(clima?.precipitacaoObservadaMm, 1, '0.0')} mm</span>
            <span>Umidade: {clima?.umidadeRelativaPct ?? '--'}%</span>
          </div>
        </div>
      </div>

      <div className="overview-central-layout">
        <div className="preview-map-box">
          <div className="preview-map-header">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🗺️</span> Malha Cartográfica de Porto Alegre-RS (OpenStreetMap)
              </h3>
              <p className="text-xs text-slate-400">
                Base cartográfica OpenStreetMap; cadastro municipal de bocas de lobo disponível no mapa completo.
              </p>
            </div>
            <button className="btn-action-primary text-xs" onClick={() => navegar('/mapa')}>
              Abrir Mapa Completo ↗
            </button>
          </div>
          <div className="preview-map-frame" style={{ cursor: 'pointer' }} onClick={() => navegar('/mapa')}>
            <MapContainer
              center={CENTRO_PORTO_ALEGRE}
              zoom={13}
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              touchZoom={false}
              boxZoom={false}
              keyboard={false}
              attributionControl={false}
              style={{ height: '100%', width: '100%', pointerEvents: 'none' }}
            >
              <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} />
            </MapContainer>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className={`alert-status-card ${s.card}`}>
            <div className={`alert-icon-wrap ${s.icone[0]}`}>{s.icone[1]}</div>
            <div>
              <div className="text-xs font-bold text-white">{s.titulo}</div>
              <div className="text-[11px] text-slate-300 mt-0.5">{s.descricao}</div>
            </div>
          </div>

          <div className="card-base">
            <div className="text-xs font-bold text-white uppercase border-b border-slate-800 pb-2 mb-2 flex justify-between">
              <span>Enlace de Telemetria</span>
              <span className="text-cyan-400 font-mono text-[11px]">{serial.leiturasRecebidas} msgs</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Porta USB:</span>
                <span className="font-mono text-white">{serial.conectado ? `${serial.porta} (${serial.baudRate} baud)` : 'Desconectada'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Erros de leitura:</span>
                <span className={`font-mono ${serial.errosParser ? 'text-amber-400' : 'text-emerald-400'}`}>{serial.errosParser} erros</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CEMADEN Porto Alegre:</span>
                <span className={corCemaden}>{textoCemaden}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Banco de dados:</span>
                <span className={`font-mono text-[11px] ${banco === 'postgres' ? 'text-emerald-400' : 'text-amber-400'}`}>{banco}</span>
              </div>
            </div>
            <button className="btn-action-secondary mt-3 text-xs w-full" onClick={() => navegar('/diagnostico')}>
              Ver Diagnóstico Completo
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
