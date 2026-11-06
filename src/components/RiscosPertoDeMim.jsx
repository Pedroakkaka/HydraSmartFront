import { useQuery } from '@tanstack/react-query';
import { CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import { api } from '../lib/api.js';

export function distanciaKm(a, b) {
  const rad = Math.PI / 180;
  const lat = (b[0] - a[0]) * rad;
  const lon = (b[1] - a[1]) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(lon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function MarcadorLocal({ localizacao }) {
  const map = useMap();
  useEffect(() => {
    if (localizacao) map.flyTo([localizacao.latitude, localizacao.longitude], 15);
  }, [map, localizacao]);
  if (!localizacao) return null;
  return <CircleMarker center={[localizacao.latitude, localizacao.longitude]} radius={11}
    pathOptions={{ color: '#fff', fillColor: '#f59e0b', fillOpacity: 1, weight: 3 }}>
    <Tooltip permanent direction="top">Sua localização aproximada</Tooltip>
  </CircleMarker>;
}

export default function RiscosPertoDeMim({ localizacao, limpar, regiao, oficial, oficialCarregando, oficialErro }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['condicoes-locais', localizacao?.latitude, localizacao?.longitude],
    queryFn: () => api.get('/brasil/condicoes-locais?latitude=' + localizacao.latitude + '&longitude=' + localizacao.longitude),
    enabled: Boolean(localizacao),
    staleTime: 600000,
    refetchInterval: 600000,
    retry: false
  });
  if (!localizacao) return null;
  const perto = regiao === 'porto_alegre' && (oficial?.elementos || []).filter(p =>
    Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) &&
    distanciaKm([localizacao.latitude, localizacao.longitude], [Number(p.lat), Number(p.lon)]) <= 0.5
  );
  const formataMm = valor => valor == null ? '—' : Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return <section className="hs-map-panel hs-map-local" aria-label="Condições meteorológicas perto de você">
    <div className="hs-map-panel-header">
      <div><span className="hs-map-eyebrow">MONITORAMENTO POR LOCALIZAÇÃO</span><h3>📍 Condições perto de você</h3></div>
      <button type="button" className="hs-map-outline-btn" onClick={limpar}>Limpar localização</button>
    </div>
    <p className="hs-map-description">Localização aproximada autorizada por você. Sem rastreamento contínuo.</p>
    {isLoading ? <p className="hs-map-loading" role="status">Consultando dados meteorológicos…</p>
    : isError || !data ? <p className="hs-map-alert" role="status">Dados meteorológicos indisponíveis nesta consulta.</p>
    : <div>
      <div className="hs-map-metrics">
        <div className="hs-map-metric"><span>Chuva observada</span><strong>{formataMm(data.precipAtualMm)} <small>mm</small></strong><small>Observação disponível</small></div>
        <div className="hs-map-metric"><span>Próximas 6 horas</span><strong>{formataMm(data.previsao6hMm)} <small>mm</small></strong><small>Precipitação prevista</small></div>
        <div className="hs-map-metric hs-map-metric-context"><span>Condição meteorológica</span><strong>{data.interpretacao || 'Sem avaliação'}</strong><small>Fonte: {data.fonte || 'Open-Meteo'}</small></div>
      </div>
    </div>}
    <div className="hs-map-extra">
      {regiao === 'porto_alegre' && <p>
        {oficialCarregando ? 'Consultando pontos de drenagem próximos…'
        : oficialErro || oficial?.status === 'indisponivel' ? 'Cadastro municipal indisponível no momento.'
        : (perto?.length || 0) + ' bocas de lobo cadastradas a até 500 m na área consultada; sem telemetria confirmada.'}
      </p>}
      {regiao === 'blumenau' && <p>Confira as leituras do Rio Itajaí-Açu e as cotas oficiais de inundação. Nível do rio não equivale a risco calculado para o endereço.</p>}
      {regiao === 'brasil' && <p>Para esta posição, o cadastro municipal ainda não está integrado. A consulta disponível é meteorológica.</p>}
    </div>
    <p className="hs-map-safety-note">ⓘ Não é diagnóstico validado de alagamento. Sem chuva prevista ou sensores, não é possível afirmar que a região esteja segura. Consulte a Defesa Civil.</p>
  </section>;
}
