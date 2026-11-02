import { useMemo, useState, useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import { useTelemetria } from '../store/useTelemetria.js';
import { useDrenosOsm, useBocasLoboOficiais } from '../hooks/useConsultas.js';
import { temLeitura } from '../lib/risco.js';
import { num } from '../lib/formato.js';

const CENTRO = [-16.0718, -57.6789];
function Recentralizar({ sinal }) {
  const map = useMap();
  useEffect(() => { if (sinal) map.flyTo(CENTRO, 14); }, [sinal, map]);
  return null;
}
export default function Mapa() {
  const bueiros = useTelemetria((s) => s.estado.bueiros);
  const { data: oficial } = useBocasLoboOficiais();
  const { data: osm } = useDrenosOsm();
  const [camadas, setCamadas] = useState({ oficial: true, osm: false, prototipo: true });
  const [recentralizar, setRecentralizar] = useState(0);
  const pontos = useMemo(() => {
    const lista = (oficial?.elementos ?? []).filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)));
    if (lista.length < 2) return [];
    const dist = (a, b) => (Number(a.lat) - Number(b.lat)) ** 2 + (Number(a.lon) - Number(b.lon)) ** 2;
    const origem = { lat: CENTRO[0], lon: CENTRO[1] };
    const a = [...lista].sort((x, y) => dist(x, origem) - dist(y, origem))[0];
    const b = [...lista].filter(x => x !== a).sort((x, y) => dist(x, a) - dist(y, a))[0];
    return [{ ...a, idSensor: 'bueiro_1' }, { ...b, idSensor: 'bueiro_2' }];
  }, [oficial]);
  const alternar = (nome) => setCamadas(v => ({ ...v, [nome]: !v[nome] }));
  return (
    <div className="map-view-layout">
      <div className="map-toolbar">
        <div className="map-toolbar-group">
          {['oficial', 'prototipo', 'osm'].map(nome => (
            <button key={nome} className={`map-control-btn ${camadas[nome] ? 'active' : ''}`} onClick={() => alternar(nome)}>
              {nome === 'oficial' ? '🟢 Cadastro municipal' : nome === 'prototipo' ? '🔵 Protótipo B1 / B2' : '🌐 OpenStreetMap'}
            </button>
          ))}
        </div>
        <button className="map-control-btn" onClick={() => setRecentralizar(v => v + 1)}>🎯 Cáceres</button>
      </div>
      <p className="text-xs text-slate-400 mb-2">Dois pontos próximos do cadastro municipal são vinculados automaticamente ao protótipo B1/B2. Vínculo demonstrativo: não representa instalação de sensores nesses locais.</p>
      <div className="map-canvas-full">
        <MapContainer center={CENTRO} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution='&copy; OpenStreetMap contributors' />
          <ZoomControl position="bottomright" />
          <Recentralizar sinal={recentralizar} />
          {camadas.oficial && (oficial?.elementos ?? []).map((p, i) => (
            <CircleMarker key={`of-${p.id ?? i}`} center={[p.lat, p.lon]} radius={3} pathOptions={{ color: '#047857', fillColor: '#10b981', fillOpacity: .7 }}>
              <Tooltip>Boca de lobo cadastrada — sem sensor confirmado</Tooltip>
            </CircleMarker>
          ))}
          {camadas.osm && (osm?.elementos ?? []).map((p, i) => (
            <CircleMarker key={`osm-${p.id ?? i}`} center={[p.lat, p.lon]} radius={3} pathOptions={{ color: '#0284c7' }}>
              <Tooltip>Registro OpenStreetMap — sem telemetria</Tooltip>
            </CircleMarker>
          ))}
          {camadas.prototipo && pontos.map(p => {
            const b = bueiros[p.idSensor];
            const ativo = b && temLeitura(b) && !b.desatualizado;
            return <CircleMarker key={p.idSensor} center={[p.lat, p.lon]} radius={10}
              pathOptions={{ color: '#22d3ee', fillColor: ativo ? '#0891b2' : '#475569', fillOpacity: 1, weight: 3 }}>
              <Tooltip permanent direction="top">
                <strong>{p.idSensor === 'bueiro_1' ? 'B1' : 'B2'}</strong> — {ativo ? `${num(b.nivelPct)}% nível medido` : 'Sem leitura atual'}
                <div>Vínculo demonstrativo • cadastro {p.id}</div>
                <div>Vazão não medida: exige sensor e calibração próprios</div>
              </Tooltip>
            </CircleMarker>;
          })}
        </MapContainer>
      </div>
      {pontos.length < 2 && <p className="text-xs text-amber-400 mt-2">Aguardando ao menos dois pontos válidos da base municipal para vincular B1 e B2.</p>}
      <div className="map-discrete-legend">
        <div className="legend-item">🟢 Cadastro público municipal (sem telemetria)</div>
        <div className="legend-item">🔵 B1 e B2: associação demonstrativa com medições independentes</div>
      </div>
    </div>
  );
}
