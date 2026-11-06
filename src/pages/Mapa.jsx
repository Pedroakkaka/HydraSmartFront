import { useMemo, useState, useEffect } from 'react';
import { divIcon } from 'leaflet';
import { CircleMarker, Marker, MapContainer, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import { useTelemetria } from '../store/useTelemetria.js';
import { useDrenosOsm, useBocasLoboOficiais, useNivelBlumenau, useFontesBrasil } from '../hooks/useConsultas.js';
import { temLeitura } from '../lib/risco.js';
import { dataHora, num } from '../lib/formato.js';

const CENTRO = [-30.0346, -51.2177];
const ICONES_REGIAO = {
  porto_alegre: divIcon({
    className: 'hydra-nacional-pin',
    html: '<div style="background:#16a34a;color:#fff;border:3px solid #dcfce7;border-radius:12px;padding:8px 12px;min-width:125px;text-align:center;font:700 13px Arial,sans-serif;box-shadow:0 4px 14px #0008;white-space:nowrap">● Porto Alegre<br><small style="font-size:10px;font-weight:400">Cadastro de bueiros</small></div>',
    iconSize: [135, 61], iconAnchor: [67, 60]
  }),
  blumenau: divIcon({
    className: 'hydra-nacional-pin',
    html: '<div style="background:#0369a1;color:#fff;border:3px solid #bae6fd;border-radius:12px;padding:8px 12px;min-width:117px;text-align:center;font:700 13px Arial,sans-serif;box-shadow:0 4px 14px #0008;white-space:nowrap">● Blumenau<br><small style="font-size:10px;font-weight:400">Dados hidrológicos</small></div>',
    iconSize: [127, 61], iconAnchor: [63, 60]
  })
};
const REGIOES = {
  brasil: { centro: [-14.235, -51.9253], zoom: 4, nome: 'Brasil' },
  porto_alegre: { centro: CENTRO, zoom: 14, nome: 'Porto Alegre - RS' },
  blumenau: { centro: [-26.9187, -49.0661], zoom: 12, nome: 'Blumenau - SC' }
};
function Recentralizar({ sinal, regiao }) {
  const map = useMap();
  useEffect(() => { const r = REGIOES[regiao]; map.flyTo(r.centro, r.zoom); }, [sinal, regiao, map]);
  return null;
}
const BBOX_INICIAL = '-51.24,-30.055,-51.19,-30.015';

// O cadastro oficial é consultado na área efetivamente visível, não em
// coordenadas fixas. A API limita as consultas a pequenas extensões.
function ConsultarAreaVisivel({ regiao, aoAlterar }) {
  const map = useMapEvents({
    moveend: () => {
      if (regiao !== 'porto_alegre') return;
      const limites = map.getBounds();
      const centro = limites.getCenter();
      const meiaLargura = Math.min(0.115, (limites.getEast() - limites.getWest()) / 2);
      const meiaAltura = Math.min(0.115, (limites.getNorth() - limites.getSouth()) / 2);
      const bbox = [centro.lng - meiaLargura, centro.lat - meiaAltura,
        centro.lng + meiaLargura, centro.lat + meiaAltura]
        .map(n => n.toFixed(4)).join(',');
      aoAlterar(atual => atual === bbox ? atual : bbox);
    }
  });
  return null;
}

export default function Mapa() {
  const bueiros = useTelemetria((s) => s.estado?.bueiros || {});
  const [regiao, setRegiao] = useState('porto_alegre');
  const { data: nivelBlumenau, isLoading: carregandoNivel } = useNivelBlumenau();
  const { data: fontesBrasil } = useFontesBrasil();
  const linkNivel = fontesBrasil?.blumenau?.nivel || 'https://defesacivil.blumenau.sc.gov.br/d/nivel-do-rio';
  const linkInundacao = fontesBrasil?.blumenau?.inundacao || 'https://defesacivil.blumenau.sc.gov.br/m/inundacao';
  const linkInmet = fontesBrasil?.inmet?.anomaliaMensal || 'https://clima.inmet.gov.br/prec';
  const [bbox, setBbox] = useState(BBOX_INICIAL);
  const { data: oficial, isLoading: oficialCarregando, isFetching: oficialAtualizando, isError: oficialErro } = useBocasLoboOficiais(bbox, regiao === 'porto_alegre');
  const { data: osm, isLoading: osmCarregando, isError: osmErro } = useDrenosOsm();
  const [camadas, setCamadas] = useState({ oficial: true, osm: false, prototipo: true });
  const [recentralizar, setRecentralizar] = useState(0);
  const [tiles, setTiles] = useState({ carregou: false, falhou: false });
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
          {regiao === 'porto_alegre' && ['oficial', 'prototipo', 'osm'].map(nome => (
            <button key={nome} className={`map-control-btn ${camadas[nome] ? 'active' : ''}`} onClick={() => alternar(nome)}>
              {nome === 'oficial' ? '🟢 Cadastro municipal' : nome === 'prototipo' ? '🔵 Protótipo B1 / B2' : '🌐 OpenStreetMap'}
            </button>
          ))}
        </div>
        <div className="map-toolbar-group">
          {Object.entries(REGIOES).map(([id, item]) => <button key={id} type="button" className={`map-control-btn ${regiao === id ? 'active' : ''}`} onClick={() => setRegiao(id)}>{item.nome}</button>)}
          <button type="button" className="map-control-btn" onClick={() => setRecentralizar(v => v + 1)}>🎯 Centralizar</button>
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-2">{regiao === 'porto_alegre' ? 'Os pontos B1/B2 são vinculados demonstrativamente ao cadastro de Porto Alegre; não representam instalação de sensores.' : regiao === 'blumenau' ? 'Níveis do Rio Itajaí-Açu e cotas de inundação são informações oficiais distintas das leituras de bueiros.' : 'Visão nacional por região. A cobertura de cadastros e sensores de drenagem varia entre municípios.'}</p>
      {regiao === 'blumenau' && <section className="card-base" aria-label="Fontes oficiais de Blumenau">
        <div className="card-header-line"><strong>Rio Itajaí-Açu · Defesa Civil Blumenau</strong></div>
        <p>Última leitura disponível: <strong>{nivelBlumenau?.ultimaLeitura ? `${num(nivelBlumenau.ultimaLeitura.nivelMetros, 2)} m` : 'Não disponível'}</strong></p>
        <p className="text-xs text-slate-400">{carregandoNivel ? 'Consultando fonte oficial...' : nivelBlumenau?.ultimaLeitura ? `Horário: ${dataHora(nivelBlumenau.ultimaLeitura.horario)} · ${nivelBlumenau.status === 'sucesso' ? 'Leitura recente' : 'Dados desatualizados'}` : 'Sem leitura verificável no momento; consultar fonte oficial.'}</p>
        <p className="text-xs text-slate-400">O mapa de inundação apresenta cotas consultivas e não informa a extensão de uma cheia atual. Estações de rio não representam sensores dos bueiros.</p>
        <div className="flex flex-wrap gap-3 mt-2"><a href={linkNivel} target="_blank" rel="noopener noreferrer">Nível do rio · AlertaBlu ↗</a><a href={linkInundacao} target="_blank" rel="noopener noreferrer">Mapa oficial de inundação ↗</a></div>
      </section>}
      {regiao === 'brasil' && <section className="card-base" aria-label="Cidades com fontes integradas">
        <div className="card-header-line"><strong>Fontes integradas no mapa nacional</strong></div>
        <p className="text-xs text-slate-300 mb-2">O mapa nacional mostra as cidades com fontes conectadas, não a localização fictícia de bueiros. Selecione um marcador ou uma cidade abaixo para ampliar.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="map-control-btn active" onClick={() => setRegiao('porto_alegre')}>🟢 Porto Alegre · cadastro de bocas de lobo</button>
          <button type="button" className="map-control-btn" onClick={() => setRegiao('blumenau')}>🔵 Blumenau · Defesa Civil / nível do rio</button>
        </div>
      </section>}
      {(regiao === 'brasil' || regiao === 'blumenau') && <section className="card-base" aria-label="Dados meteorológicos INMET">
        <div className="card-header-line"><strong>INMET · Anomalias de precipitação</strong></div>
        <p className="text-xs text-slate-400">Compare chuva observada e climatologia em mapas oficiais mensais. Anomalias históricas não são previsões de alagamento.</p>
        <a href={linkInmet} target="_blank" rel="noopener noreferrer">Consultar mapas mensais INMET ↗</a>
      </section>}
      <div className="map-canvas-full">
        <MapContainer center={CENTRO} zoom={14} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            attribution='&copy; OpenStreetMap contributors'
            eventHandlers={{
              tileload: () => setTiles((v) => ({ ...v, carregou: true })),
              tileerror: () => setTiles((v) => ({ ...v, falhou: true }))
            }}
          />
          <ZoomControl position="bottomright" />
          <Recentralizar sinal={recentralizar} regiao={regiao} />
          <ConsultarAreaVisivel regiao={regiao} aoAlterar={setBbox} />
          {regiao === 'brasil' && Object.entries(REGIOES).filter(([id]) => id !== 'brasil').map(([id, item]) => (
            <Marker key={id} position={item.centro} icon={ICONES_REGIAO[id]} zIndexOffset={1000}
              eventHandlers={{ click: () => setRegiao(id) }}>
              <Tooltip>{item.nome} — clique para ampliar as fontes cadastradas</Tooltip>
            </Marker>
          ))}
          {regiao === 'porto_alegre' && camadas.oficial && (oficial?.elementos ?? []).map((p, i) => (
            <CircleMarker key={`of-${p.id ?? i}`} center={[Number(p.lat), Number(p.lon)]} radius={5} pathOptions={{ color: '#065f46', fillColor: '#22c55e', fillOpacity: .9, weight: 1.5 }}>
              <Tooltip>Boca de lobo cadastrada — Prefeitura de Porto Alegre · ID {p.id ?? 'não informado'} · sem sensor confirmado</Tooltip>
            </CircleMarker>
          ))}
          {regiao === 'porto_alegre' && camadas.osm && (osm?.elementos ?? []).map((p, i) => (
            <CircleMarker key={`osm-${p.id ?? i}`} center={[p.lat, p.lon]} radius={3} pathOptions={{ color: '#0284c7' }}>
              <Tooltip>Registro OpenStreetMap — sem telemetria</Tooltip>
            </CircleMarker>
          ))}
          {regiao === 'porto_alegre' && camadas.prototipo && pontos.map(p => {
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
      {regiao === 'porto_alegre' && camadas.oficial && <p className="text-xs text-slate-400 mt-2" aria-live="polite">🟢 {oficialCarregando ? 'Buscando pontos verdes do cadastro municipal…' : oficialErro || oficial?.status === 'indisponivel' ? 'Cadastro oficial indisponível; consulte novamente ou aproxime o mapa.' : `${(oficial?.elementos || []).length} bocas de lobo do cadastro oficial nesta área`}{oficialAtualizando && !oficialCarregando ? ' · atualizando área…' : ''}{oficial?.parcial ? ' · limite por consulta: aproxime o mapa para detalhar' : ''}</p>}
      <div className="space-y-1" aria-live="polite">
        {tiles.falhou && <p role="status" className="text-xs text-amber-400">
          {tiles.carregou
            ? 'Algumas imagens da base cartográfica OpenStreetMap falharam; o mapa pode aparecer parcialmente.'
            : 'Base cartográfica OpenStreetMap indisponível; marcadores de sensores e cadastros são consultados separadamente.'}
        </p>}
        {regiao === 'porto_alegre' && camadas.oficial && oficialCarregando && <p role="status" className="text-xs text-slate-400">Consultando o cadastro público municipal…</p>}
        {regiao === 'porto_alegre' && camadas.oficial && (oficialErro || oficial?.status === 'indisponivel') && <p role="status" className="text-xs text-amber-400">Cadastro municipal indisponível; nenhum ponto desse cadastro está sendo apresentado como sensor.</p>}
        {regiao === 'porto_alegre' && camadas.oficial && oficial?.status === 'sucesso' && oficial.elementos?.length === 0 && <p role="status" className="text-xs text-slate-400">A consulta ao cadastro municipal não retornou pontos para esta área.</p>}
        {regiao === 'porto_alegre' && camadas.osm && osmCarregando && <p role="status" className="text-xs text-slate-400">Consultando elementos de drenagem do OpenStreetMap…</p>}
        {regiao === 'porto_alegre' && camadas.osm && osmErro && <p role="status" className="text-xs text-amber-400">Não foi possível consultar o serviço OSM. Os sensores físicos e o cadastro municipal são camadas independentes.</p>}
        {regiao === 'porto_alegre' && camadas.osm && osm?.status === 'desatualizado' && <p role="status" className="text-xs text-amber-400">OpenStreetMap indisponível agora; os pontos mostrados vêm do último cache válido ({dataHora(osm.consultadoEm)}).</p>}
        {regiao === 'porto_alegre' && camadas.osm && osm?.status === 'indisponivel' && <p role="status" className="text-xs text-amber-400">Serviço de consulta OpenStreetMap indisponível; nenhum elemento OSM está sendo mostrado.</p>}
        {regiao === 'porto_alegre' && camadas.osm && osm?.status === 'sucesso' && osm.elementos?.length === 0 && <p role="status" className="text-xs text-slate-400">A consulta OSM não encontrou elementos mapeados nesta área; cobertura não exaustiva.</p>}
      </div>
      {regiao === 'porto_alegre' && pontos.length < 2 && <p className="text-xs text-amber-400 mt-2">Aguardando ao menos dois pontos válidos da base municipal para vincular B1 e B2.</p>}
      <div className="map-discrete-legend">
        {regiao === 'porto_alegre' && <div className="legend-item">🟢 Cadastro público municipal (sem telemetria)</div>}
        {regiao === 'porto_alegre' && <div className="legend-item">🔵 B1 e B2: associação demonstrativa com medições independentes</div>}
      </div>
    </div>
  );
}
