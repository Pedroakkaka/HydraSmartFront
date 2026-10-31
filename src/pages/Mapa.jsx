import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import { useTelemetria } from '../store/useTelemetria.js';
import { useDrenosOsm } from '../hooks/useConsultas.js';
import { useAcao } from '../hooks/useAcoes.js';
import { api } from '../lib/api.js';
import { metaRisco, temLeitura } from '../lib/risco.js';
import { num } from '../lib/formato.js';

const CENTRO_PORTO_ALEGRE = [-30.0346, -51.2177];
const ZOOM_INICIAL = 14;
const NOMES = { bueiro_1: 'Bueiro 01', bueiro_2: 'Bueiro 02' };

function iconeBueiro(bueiro, selecionado) {
  const meta = metaRisco(temLeitura(bueiro) ? bueiro.risco : 'desconhecido');
  return L.divIcon({
    className: 'scada-div-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `
      <div class="scada-marker ${selecionado ? 'marker-selected' : ''}" style="--marker-color: ${meta.cor};">
        <div class="marker-pulse" style="background: ${meta.cor};"></div>
        <div class="marker-dot" style="background: ${meta.cor}; border: 2px solid #ffffff;">
          <span class="marker-label">B${bueiro.codigoCurto}</span>
        </div>
        <div class="marker-level-badge">${temLeitura(bueiro) ? `${bueiro.nivelPct.toFixed(0)}%` : 'OFF'}</div>
      </div>`
  });
}

/** Captura o clique no mapa quando o modo de marcação está ativo. */
function CapturaClique({ ativo, aoCapturar }) {
  const mapa = useMapEvents({
    click(e) {
      if (ativo) aoCapturar(e.latlng);
    }
  });
  useEffect(() => {
    mapa.getContainer().style.cursor = ativo ? 'crosshair' : '';
  }, [ativo, mapa]);
  return null;
}

/** Expõe o controle de "voar até" para os botões fora do mapa. */
function ControleVoo({ alvo }) {
  const mapa = useMap();
  useEffect(() => {
    if (alvo) mapa.flyTo(alvo.coords, alvo.zoom, { duration: 1.2 });
  }, [alvo, mapa]);
  return null;
}

function FormCoordenadas({ bueiro, cor, executar, ocupado }) {
  const cfg = bueiro.calibracao;
  const chave = `${cfg.latitude}|${cfg.longitude}`;
  const [campos, setCampos] = useState({ chave, lat: cfg.latitude ?? '', lng: cfg.longitude ?? '' });
  if (campos.chave !== chave) setCampos({ chave, lat: cfg.latitude ?? '', lng: cfg.longitude ?? '' });

  const salvar = () => {
    const latitude = Number.parseFloat(campos.lat);
    const longitude = Number.parseFloat(campos.lng);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      executar(() => Promise.reject(new Error(`Informe latitude e longitude numéricas para o ${NOMES[bueiro.id]}.`)), { beep: 0 });
      return;
    }
    executar(() => api.put(`/bueiros/${bueiro.id}/coordenadas`, { latitude, longitude }), {
      sucesso: `Coordenadas do ${NOMES[bueiro.id]} confirmadas.`
    });
  };

  return (
    <div className="bg-slate-900/60 p-3 rounded border border-slate-800 space-y-2">
      <div className="flex items-center justify-between">
        <span className={`font-bold text-xs ${cor}`}>{cfg.nome}</span>
        <span className={`coord-status-badge ${cfg.coordenadasConfirmadas ? 'confirmada' : 'nao-confirmada'}`}>
          {cfg.coordenadasConfirmadas ? 'Localização confirmada' : 'Localização não confirmada'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="block text-slate-400 text-[10px] mb-1">Latitude</label>
          <input type="number" step="0.000001" placeholder="Ex: -30.034600" className="coord-input"
            value={campos.lat} onChange={(e) => setCampos((c) => ({ ...c, lat: e.target.value }))} />
        </div>
        <div>
          <label className="block text-slate-400 text-[10px] mb-1">Longitude</label>
          <input type="number" step="0.000001" placeholder="Ex: -51.217700" className="coord-input"
            value={campos.lng} onChange={(e) => setCampos((c) => ({ ...c, lng: e.target.value }))} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button className="btn-action-secondary text-xs" disabled={ocupado}
          onClick={() => executar(() => api.del(`/bueiros/${bueiro.id}/coordenadas`), { beep: 600 })}>
          Limpar
        </button>
        <button className="btn-action-primary text-xs" disabled={ocupado} onClick={salvar}>
          Salvar Coordenadas {bueiro.id === 'bueiro_1' ? 'B1' : 'B2'}
        </button>
      </div>
    </div>
  );
}

export default function Mapa() {
  const bueiros = useTelemetria((s) => s.estado.bueiros);
  const { data: osm } = useDrenosOsm();
  const { executar, ocupado } = useAcao();

  const [camadas, setCamadas] = useState({ prototipo: true, osm: true });
  const [selecionado, setSelecionado] = useState('bueiro_1');
  const [capturando, setCapturando] = useState(false);
  const [voo, setVoo] = useState(null);

  const drenos = useMemo(() => osm?.elementos ?? [], [osm]);
  const lista = Object.values(bueiros).filter((b) => b.calibracao.coordenadasConfirmadas);

  const capturar = ({ lat, lng }) => {
    setCapturando(false);
    executar(() => api.put(`/bueiros/${selecionado}/coordenadas`, { latitude: lat, longitude: lng }), {
      sucesso: `${NOMES[selecionado]} posicionado em ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      beep: 950
    });
  };

  const alternarCamada = (nome) => setCamadas((c) => ({ ...c, [nome]: !c[nome] }));

  return (
    <>
      <div className="map-view-layout">
        <div className="map-toolbar">
          <div className="map-toolbar-group">
            <button className={`map-control-btn ${camadas.prototipo ? 'active' : ''}`} onClick={() => alternarCamada('prototipo')}>
              <span className="w-2 h-2 rounded-full bg-cyan-400" /> Sensores físicos confirmados
            </button>
            <button className={`map-control-btn ${camadas.osm ? 'active' : ''}`} onClick={() => alternarCamada('osm')}
              title={osm?.mensagem}>
              <span className="w-2 h-2 rounded-full bg-sky-400" /> Drenagem OSM {drenos.length ? `(${drenos.length})` : ''}
            </button>
          </div>
          <div className="map-toolbar-group">
            <button className="map-control-btn" onClick={() => setVoo({ coords: CENTRO_PORTO_ALEGRE, zoom: ZOOM_INICIAL, t: Date.now() })}>
              🎯 Recentralizar Porto Alegre
            </button>
            <button className={`map-control-btn ${capturando ? 'active' : ''}`} onClick={() => setCapturando((v) => !v)}>
              {capturando ? `📍 Clique no mapa para ${NOMES[selecionado]}...` : '📍 Marcar Posição no Mapa'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-2">Porto Alegre–RS • Elementos OSM são registros cartográficos públicos, não representam inventário completo nem leituras em tempo real. Sensores físicos são mostrados separadamente.</p>
        <div className="map-canvas-full">
          <MapContainer center={CENTRO_PORTO_ALEGRE} zoom={ZOOM_INICIAL} zoomControl={false} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
            />
            <ZoomControl position="bottomright" />
            <CapturaClique ativo={capturando} aoCapturar={capturar} />
            <ControleVoo alvo={voo} />

            {camadas.osm && drenos.map((d) => (
              <CircleMarker key={d.id} center={[d.lat, d.lon]} radius={4}
                pathOptions={{ fillColor: '#38bdf8', color: '#0284c7', weight: 1, opacity: 0.8, fillOpacity: 0.6 }}>
                <Tooltip className="scada-map-tooltip">
                  <div className="text-[11px] p-1">
                    <div className="font-bold text-sky-400">Elemento de drenagem cadastrado no OSM</div>
                    <div className="text-[10px] text-slate-300">ID: {d.id} • Tipo: {d.tipo}</div>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}

            {camadas.prototipo && lista.map((b) => {
              const cfg = b.calibracao;
              const meta = metaRisco(b.risco);
              return (
                <Marker key={b.id} position={[cfg.latitude, cfg.longitude]} icon={iconeBueiro(b, selecionado === b.id)}
                  zIndexOffset={1000} eventHandlers={{ click: () => setSelecionado(b.id) }}>
                  <Tooltip className="scada-map-tooltip" direction="top" offset={[0, -18]}>
                    <div className="p-1">
                      <div className="font-bold text-xs text-white">{cfg.nome}</div>
                      <div className="text-[10px] text-cyan-300 font-mono">SENSOR FÍSICO ({cfg.pinoTrig}/{cfg.pinoEcho})</div>
                      <div className="text-[11px] font-mono mt-1 font-semibold" style={{ color: meta.cor }}>
                        {temLeitura(b) ? `Nível: ${num(b.nivelPct)}% (${num(b.alturaAguaCm)} cm d'água)` : 'Aguardando leituras'}
                      </div>
                      <div className="text-[10px] text-slate-400">Origem: {b.origem}</div>
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <div className="map-discrete-legend">
          <div className="legend-item">
            <span className="legend-color-box bg-cyan-400" />
            <span>Bueiros Físicos Confirmados (Sensores HC-SR04)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color-box bg-sky-400" />
            <span>Drenagem mapeada no OpenStreetMap (cadastro parcial; sem sensor)</span>
          </div>
        </div>
      </div>

      <div className="coord-config-card mt-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">📍 Configuração Geográfica dos Bueiros Físicos</span>
            <span className="text-xs text-slate-400 font-mono">Os bueiros só aparecem no mapa depois de confirmados</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Marcar no mapa:</span>
            {['bueiro_1', 'bueiro_2'].map((id) => (
              <button key={id} className={`${selecionado === id ? 'btn-action-primary' : 'btn-action-secondary'} text-xs`}
                onClick={() => setSelecionado(id)}>
                {NOMES[id]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2-md">
          <FormCoordenadas bueiro={bueiros.bueiro_1} cor="text-cyan-400" executar={executar} ocupado={ocupado} />
          <FormCoordenadas bueiro={bueiros.bueiro_2} cor="text-amber-400" executar={executar} ocupado={ocupado} />
        </div>
        <div className="text-[11px] text-slate-400">
          * Dica: escolha o bueiro acima, clique em <b>&quot;📍 Marcar Posição no Mapa&quot;</b> e depois no local exato do mapa.
        </div>
      </div>
    </>
  );
}
