import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { CircleMarker, MapContainer, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import { useTelemetria } from '../store/useTelemetria.js';
import RiscosPertoDeMim, { MarcadorLocal, distanciaKm } from '../components/RiscosPertoDeMim.jsx';
import BuscaCidade from '../components/BuscaCidade.jsx';
import { useDrenosOsm, useBocasLoboOficiais, useNivelBlumenau, useFontesBrasil } from '../hooks/useConsultas.js';
import { temLeitura } from '../lib/risco.js';
import { dataHora, num } from '../lib/formato.js';

const CENTRO = [-30.0346, -51.2177];
const REGIOES = {
  brasil: { centro: [-14.235, -51.9253], zoom: 4, nome: 'Brasil' },
  porto_alegre: { centro: CENTRO, zoom: 14, nome: 'Porto Alegre - RS' },
  blumenau: { centro: [-26.9187, -49.0661], zoom: 12, nome: 'Blumenau - SC' }
};
function Recentralizar({ sinal, regiao, cidade }) {
  const map = useMap();
  useEffect(() => { const r = regiao === 'cidade' && cidade ? { centro: [cidade.latitude, cidade.longitude], zoom: 14 } : REGIOES[regiao]; if (r) map.flyTo(r.centro, r.zoom); }, [sinal, regiao, cidade, map]);
  return null;
}
const BBOX_INICIAL = '-51.24,-30.055,-51.19,-30.015';

// O cadastro oficial é consultado na área efetivamente visível, não em
// coordenadas fixas. A API limita as consultas a pequenas extensões.
function ConsultarAreaVisivel({ regiao, aoAlterar, aoAlterarNacional }) {
  const timer = useRef(null);
  const map = useMapEvents({
    moveend: () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const limite = map.getBounds();
        const centro = limite.getCenter();
        const zoom = map.getZoom();
        // Janela estabilizada em quadrículas ~1,1 km: evita uma consulta nova
        // para cada pixel de deslocamento e protege o Overpass público.
        const passo = zoom >= 16 ? 0.005 : 0.01;
        const centroLat = Math.round(centro.lat / passo) * passo;
        const centroLon = Math.round(centro.lng / passo) * passo;
        const meiaLargura = Math.min(0.075, Math.max(0.009, (limite.getEast() - limite.getWest()) / 2));
        const meiaAltura = Math.min(0.075, Math.max(0.009, (limite.getNorth() - limite.getSouth()) / 2));
        const coords = [centroLon - meiaLargura, centroLat - meiaAltura,
          centroLon + meiaLargura, centroLat + meiaAltura];
        const bbox = coords.map(n => n.toFixed(3)).join(',');
        if (regiao === 'porto_alegre') aoAlterar(prev => prev === bbox ? prev : bbox);
        aoAlterarNacional(prev => prev.bbox === bbox && prev.zoom === zoom ? prev : { bbox, zoom });
      }, 750);
    }
  });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return null;
}

export default function Mapa() {
  const bueiros = useTelemetria((s) => s.estado?.bueiros || {});
  const [regiao, setRegiao] = useState('porto_alegre');
  const [cidadeSelecionada, setCidadeSelecionada] = useState(null);
  const [localizacao, setLocalizacao] = useState(null);
  const [obtendoLocalizacao, setObtendoLocalizacao] = useState(false);
  const [erroLocalizacao, setErroLocalizacao] = useState('');
  const localizar = () => {
    if (!navigator.geolocation) {
      setErroLocalizacao('Seu navegador não permite consultar a localização.');
      return;
    }
    setObtendoLocalizacao(true);
    setErroLocalizacao('');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const latitude = Math.round(coords.latitude * 1000) / 1000;
      const longitude = Math.round(coords.longitude * 1000) / 1000;
      if (latitude < -34 || latitude > 6 || longitude < -74 || longitude > -34) {
        setErroLocalizacao('A consulta meteorológica por posição está disponível apenas no Brasil.');
        setObtendoLocalizacao(false);
        return;
      }
      setLocalizacao({ latitude, longitude, id: Date.now() });
      const pos = [latitude, longitude];
      setRegiao(distanciaKm(pos, REGIOES.porto_alegre.centro) <= 30 ? 'porto_alegre'
        : distanciaKm(pos, REGIOES.blumenau.centro) <= 25 ? 'blumenau' : 'brasil');
      setObtendoLocalizacao(false);
    }, (err) => {
      setErroLocalizacao(err.code === 1 ? 'Permissão negada. Autorize a localização no navegador.' : 'Localização indisponível; verifique GPS e conexão.');
      setObtendoLocalizacao(false);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 });
  };
  const { data: nivelBlumenau, isLoading: carregandoNivel } = useNivelBlumenau();
  const { data: fontesBrasil } = useFontesBrasil();
  const linkNivel = fontesBrasil?.blumenau?.nivel || 'https://defesacivil.blumenau.sc.gov.br/d/nivel-do-rio';
  const linkInundacao = fontesBrasil?.blumenau?.inundacao || 'https://defesacivil.blumenau.sc.gov.br/m/inundacao';
  const linkInmet = fontesBrasil?.inmet?.anomaliaMensal || 'https://clima.inmet.gov.br/prec';
  const [bbox, setBbox] = useState(BBOX_INICIAL);
  const [areaNacional, setAreaNacional] = useState({ bbox: BBOX_INICIAL, zoom: 14 });
  const { data: oficial, isLoading: oficialCarregando, isFetching: oficialAtualizando, isError: oficialErro } = useBocasLoboOficiais(bbox, regiao === 'porto_alegre');
  const { data: osm, isLoading: osmCarregando, isError: osmErro } = useDrenosOsm();
  const consultarDrenagem = areaNacional.zoom >= 13 &&
    (regiao === 'cidade' || regiao === 'blumenau' || regiao === 'porto_alegre' || regiao === 'brasil');
  const { data: drenosCidade, isLoading: drenagemCarregando, isFetching: drenagemAtualizando, isError: drenagemErro } = useQuery({
    queryKey: ['drenagem-nacional-area', areaNacional.bbox],
    queryFn: () => api.get('/brasil/drenagem-area?bbox=' + encodeURIComponent(areaNacional.bbox)),
    enabled: Boolean(consultarDrenagem), staleTime: 30 * 60_000, retry: false, refetchOnWindowFocus: false
  });
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
  const selecionarCidade = (cidade) => {
    setCidadeSelecionada(cidade);
    const coord = [cidade.latitude, cidade.longitude];
    setRegiao(distanciaKm(coord, REGIOES.porto_alegre.centro) < 22 ? 'porto_alegre'
      : distanciaKm(coord, REGIOES.blumenau.centro) < 18 ? 'blumenau' : 'cidade');
    setRecentralizar(v => v + 1);
  };
  const alternar = (nome) => setCamadas(v => ({ ...v, [nome]: !v[nome] }));
  return (
    <div className="map-view-layout">
      <div className="map-toolbar">
        <BuscaCidade onSelect={selecionarCidade} />
        <div className="map-toolbar-group">
          {regiao === 'porto_alegre' && ['oficial', 'prototipo', 'osm'].map(nome => (
            <button key={nome} className={`map-control-btn ${camadas[nome] ? 'active' : ''}`} onClick={() => alternar(nome)}>
              {nome === 'oficial' ? '🟢 Cadastro municipal' : nome === 'prototipo' ? '🔵 Protótipo B1 / B2' : '🌐 OpenStreetMap'}
            </button>
          ))}
        </div>
        <div className="map-toolbar-group">
          <button type="button" className="map-control-btn" onClick={() => setRecentralizar(v => v + 1)}>🎯 Centralizar</button>
          <button type="button" className="map-control-btn active" disabled={obtendoLocalizacao} onClick={localizar}>{obtendoLocalizacao ? 'Localizando…' : '📍 Riscos perto de mim'}</button>
        </div>
      </div>
      <p className="hs-map-subtitle">{regiao === 'porto_alegre' ? 'Porto Alegre · Cadastro municipal georreferenciado. Pontos de bueiros não representam sensores ativos.' : regiao === 'blumenau' ? 'Blumenau · Drenagem mapeada e fontes da Defesa Civil. Dados de rio não equivalem a sensores de bueiro.' : regiao === 'cidade' ? `${cidadeSelecionada?.nome || 'Município'} · Pontos colaborativos OpenStreetMap quando existentes, sem telemetria confirmada.` : 'Visão nacional · Selecione uma cidade para consultar os dados disponíveis.'}</p>
      {erroLocalizacao && <p role="alert" className="text-xs text-amber-400">{erroLocalizacao}</p>}
      <RiscosPertoDeMim localizacao={localizacao} limpar={() => setLocalizacao(null)} regiao={regiao}
        oficial={oficial} oficialCarregando={oficialCarregando} oficialErro={oficialErro} />
      {regiao === 'blumenau' && <section className="card-base" aria-label="Fontes oficiais de Blumenau">
        <div className="card-header-line"><strong>Rio Itajaí-Açu · Defesa Civil Blumenau</strong></div>
        <p>Última leitura disponível: <strong>{nivelBlumenau?.ultimaLeitura ? `${num(nivelBlumenau.ultimaLeitura.nivelMetros, 2)} m` : 'Não disponível'}</strong></p>
        <p className="text-xs text-slate-400">{carregandoNivel ? 'Consultando fonte oficial...' : nivelBlumenau?.ultimaLeitura ? `Horário: ${dataHora(nivelBlumenau.ultimaLeitura.horario)} · ${nivelBlumenau.status === 'sucesso' ? 'Leitura recente' : 'Dados desatualizados'}` : 'Sem leitura verificável no momento; consultar fonte oficial.'}</p>
        <p className="text-xs text-slate-400">O mapa de inundação apresenta cotas consultivas e não informa a extensão de uma cheia atual. Estações de rio não representam sensores dos bueiros.</p>
        <div className="flex flex-wrap gap-3 mt-2"><a href={linkNivel} target="_blank" rel="noopener noreferrer">Nível do rio · AlertaBlu ↗</a><a href={linkInundacao} target="_blank" rel="noopener noreferrer">Mapa oficial de inundação ↗</a></div>
      </section>}
      {(regiao === 'brasil' || regiao === 'blumenau' || regiao === 'cidade') && <section className="card-base hs-map-panel hs-map-inmet" aria-label="Dados meteorológicos INMET">
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
          <Recentralizar sinal={recentralizar} regiao={regiao} cidade={cidadeSelecionada} />
          <MarcadorLocal localizacao={localizacao} />
          <ConsultarAreaVisivel regiao={regiao} aoAlterar={setBbox} aoAlterarNacional={setAreaNacional} />

          {regiao === 'porto_alegre' && camadas.oficial && (oficial?.elementos ?? []).map((p, i) => (
            <CircleMarker key={`of-${p.id ?? i}`} center={[Number(p.lat), Number(p.lon)]} radius={5} pathOptions={{ color: '#065f46', fillColor: '#22c55e', fillOpacity: .9, weight: 1.5 }}>
              <Tooltip>Boca de lobo cadastrada — Prefeitura de Porto Alegre · ID {p.id ?? 'não informado'} · sem sensor confirmado</Tooltip>
            </CircleMarker>
          ))}
          {consultarDrenagem && (drenosCidade?.elementos || []).map((p, i) => (
            <CircleMarker key={p.id || `cidade-${i}`} center={[Number(p.lat), Number(p.lon)]} radius={6}
              pathOptions={{ color: p.fonteTipo === 'oficial' ? '#047857' : '#075985', fillColor: p.fonteTipo === 'oficial' ? '#22c55e' : '#38bdf8', fillOpacity: .9, weight: 2 }}>
              <Tooltip>{p.fonteTipo === 'oficial' ? 'Cadastro oficial — ' : 'Cadastro colaborativo — '}{p.origem} · sem sensor · {p.tipo || 'dreno'}</Tooltip>
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
      <p className="hs-map-data-caption" role="status">
        {areaNacional.zoom < 13 ? 'Aproxime o mapa para consultar bueiros cadastrados nesta região.' :
          drenagemCarregando || drenagemAtualizando ? 'Consultando os pontos de drenagem na área visível…' :
          drenagemErro || drenosCidade?.status === 'indisponivel' ? 'Consulta pública de drenagem indisponível ou sobrecarregada. Nenhum ponto pode ser confirmado nesta área.' :
          (drenosCidade?.elementos?.length === 0 ? 'Nenhum bueiro georreferenciado disponível nas fontes consultadas desta área. Isso não significa que não existam bueiros na cidade.' : `${drenosCidade?.contagem?.oficiais || 0} registros oficiais e ${drenosCidade?.contagem?.colaborativos || 0} registros OpenStreetMap na área visível. Cobertura parcial.`)}
      </p>
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
